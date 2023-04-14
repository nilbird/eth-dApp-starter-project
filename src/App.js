import React, { useEffect, useState } from "react";
import "./App.css";
import { ethers } from "ethers";
import abi from "./utils/WavePortal.json";

const App = () => {
  /* ユーザーのパブリックウォレットを保存するために使用する状態変数を定義します */
  const [currentAccount, setCurrentAccount] = useState("");

  const [currentChainID, setCurrentChainID] = useState(0);

  // ユーザーのメッセージを保存するために使用する状態変数を定義
  const [messageValue, setMessageValue] = useState("");
  // すべてのwavesを保存する状態変数を定義
  const [allWaves, setAllWaves] = useState([]);
  console.log("currentAccount: ", currentAccount);

  const contractAddress = "0xa1750e83d0c13fc151166596c244adb471a15069";
  const contractABI = abi.abi;

  const chainIdSepolia = 11155111;

  const getChainID = async (ethereum) => {
    const chainId = await ethereum.request({ method: "eth_chainId" });
    return parseInt(chainId);
  };

  const isSepolia = () => currentChainID === chainIdSepolia;

  const accountChanged = async (accounts) => {
    const account = accounts.length ? accounts[0] : "";
    setCurrentAccount(account);
    console.log("account changed:", account);
    getAllWaves();
  };

  const chainIdChanged = async (strChainID) => {
    const chainID = parseInt(strChainID);
    setCurrentChainID(chainID);
    console.log("chainID changed:", chainID);
    getAllWaves();
  };

  const getAllWaves = async () => {
    const { ethereum } = window;

    try {
      if (ethereum) {
        const chainID = await getChainID(ethereum);
        console.log(chainID);
        setCurrentChainID(chainID);

        if (chainID !== chainIdSepolia) {
          setAllWaves([]);
          return;
        }

        const provider = new ethers.providers.Web3Provider(ethereum);
        //const signer = provider.getSigner();
        const wavePortalContract = new ethers.Contract(
          contractAddress,
          contractABI,
          // signer,
          provider // signerを指定しない場合はReadOnly
        );
        // コントラクトからgetAllWavesメソッドを呼び出す
        const waves = await wavePortalContract.getAllWaves();
        const wavesCleaned = waves.map((wave) => {
          console.log("address:", wave.waver, typeof wave.waver);
          console.log("prize:", wave.prizeAmount, typeof wave.prizeAmount);

          return {
            address: wave.waver,
            timestamp: new Date(wave.timestamp * 1000),
            prizeAmount: wave.prizeAmount,
            message: wave.message,
          };
        });

        // React Stateにデータを格納する
        setAllWaves(wavesCleaned);
      } else {
        setAllWaves([]);
        console.log("Ethereum object doesn't exist!");
      }
    } catch (error) {
      setAllWaves([]);
      console.log(error);
    }
  };

  // emitされたイベントに反応する。
  useEffect(() => {
    let wavePortalContract;

    const onNewWave = (from, timestamp, prizeAmount, message) => {
      console.log("NewWave", from, timestamp, prizeAmount, message);
      setAllWaves((prevState) => [
        ...prevState,
        {
          address: from,
          timestamp: new Date(timestamp * 1000),
          prizeAmount: prizeAmount,
          message: message,
        },
      ]);
    };

    // NewWaveイベントがコントラクトから発信されたときに、情報を受け取ります
    if (window.ethereum) {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();

      wavePortalContract = new ethers.Contract(
        contractAddress,
        contractABI,
        signer
      );
      wavePortalContract.on("NewWave", onNewWave);
    }
    // メモリリークを防ぐために、NewWaveのイベントを解除します
    return () => {
      if (wavePortalContract) {
        wavePortalContract.off("NewWave", onNewWave);
      }
    };
  }, []);

  /* window.ethereumにアクセスできることを確認します */
  const checkIfWalletIsConnected = async () => {
    try {
      const { ethereum } = window;
      if (!ethereum) {
        console.log("Make sure you have MetaMask!");
        return;
      } else {
        console.log("We have the ethereum object", ethereum);
      }
      /* ユーザーのウォレットへのアクセスが許可されているかどうかを確認します */
      const accounts = await ethereum.request({ method: "eth_accounts" });
      if (accounts.length !== 0) {
        const account = accounts[0];
        console.log("Found an authorized account: ", account);
        setCurrentAccount(account);
        //getAllWaves();
      } else {
        console.log("No authorized account found");
      }
    } catch (error) {
      console.log(error);
    }
  };
  // connectWalletメソッドを実装
  const connectWallet = async () => {
    try {
      const { ethereum } = window;
      if (!ethereum) {
        alert("Get MetaMask!");
        return;
      }
      const accounts = await ethereum.request({
        method: "eth_requestAccounts",
      });
      console.log("Connected: ", accounts[0]);
      setCurrentAccount(accounts[0]);
      getAllWaves();
    } catch (error) {
      console.log(error);
    }
  };
  // Waveの回数をカウントする関数を実装
  const wave = async () => {
    try {
      const { ethereum } = window;
      if (ethereum) {
        const provider = new ethers.providers.Web3Provider(ethereum);
        const signer = provider.getSigner();
        const wavePortalContract = new ethers.Contract(
          contractAddress,
          contractABI,
          signer
        );
        let count = await wavePortalContract.getTotalWaves();
        console.log("Retrieved total wave count...", count.toNumber());
        let contractBalance = await provider.getBalance(
          wavePortalContract.address
        );
        console.log(
          "Contract balance:",
          ethers.utils.formatEther(contractBalance)
        );

        // コントラクトにwaveを書き込む
        const waveTxn = await wavePortalContract.wave(messageValue, {
          gasLimit: 300000,
        });
        console.log("Mining...", waveTxn.hash);
        await waveTxn.wait();
        console.log("Mined -- ", waveTxn.hash);
        count = await wavePortalContract.getTotalWaves();
        console.log("Retrieved total wave count...", count.toNumber());

        let contractBalance_post = await provider.getBalance(
          wavePortalContract.address
        );
        // コントラクトの残高が減っていいることを確認
        if (contractBalance_post.lt(contractBalance)) {
          console.log("User won ETH!");
        } else {
          console.log("User didn't win ETH.");
        }
        console.log(
          "Contract balance after wave:",
          ethers.utils.formatEther(contractBalance_post)
        );
      } else {
        console.log("Ethereum object doesn't exist!");
      }
    } catch (error) {
      console.log(error);
    }
  };

  // WEBページがロードされたときに下記の関数を実行します
  useEffect(() => {
    const { ethereum } = window;
    if (ethereum) {
      ethereum.on("accountsChanged", accountChanged);
      ethereum.on("chainChanged", chainIdChanged);
    }

    checkIfWalletIsConnected();
    getAllWaves();

    return () => {
      if (ethereum) {
        ethereum.removeListener("accountsChanged", accountChanged);
        ethereum.removeListener("chainChanged", chainIdChanged);
      }
    };
  }, []);

  return (
    <div className="mainContainer">
      <div className="dataContainer">
        <div className="header">
          <span role="img" aria-label="hand-wave">
            👋
          </span>{" "}
          WELCOME!
        </div>
        <div className="bio">
          イーサリアムウォレットを接続して、メッセージを作成したら、
          <span role="img" aria-label="hand-wave">
            👋
          </span>
          を送ってください
          <span role="img" aria-label="shine">
            ✨
          </span>
        </div>
        <br />
        {/* ウォレットコネクトのボタンを実装 */}
        {!currentAccount && (
          <button className="waveButton" onClick={connectWallet}>
            Connect Wallet
          </button>
        )}
        {currentAccount && (
          <button className="walletConected">
            {isSepolia()
              ? "Wallet Connected"
              : "MetaMaskの接続先をSepoliaテストネットワークに変更してください"}
          </button>
        )}
        {/* waveボタンにwave関数を連動 */}
        {/* メッセージボックスを実装 */}
        {currentAccount && isSepolia() && (
          <>
            <button className="waveButton" onClick={wave}>
              Wave at Me
            </button>
            <textarea
              name="messageArea"
              placeholder="メッセージはこちら"
              type="text"
              id="message"
              value={messageValue}
              onChange={(e) => setMessageValue(e.target.value)}
            />
          </>
        )}
        {/* 履歴を表示する */}
        {isSepolia() && allWaves !== [] && <Waves waves={allWaves} />}
      </div>
    </div>
  );
};

function Waves({ waves }) {
  return (
    <div>
      <div className="waveCount">Wave Count : {waves.length}</div>
      {waves
        .slice(0)
        .reverse()
        .map((wave, index) => {
          return (
            <div
              key={index}
              className={
                0 < wave.prizeAmount ? "waveMessageWin" : "waveMessage"
              }
            >
              <div>Address: {wave.address}</div>
              <div>Time: {wave.timestamp.toString()}</div>
              <div>Prize: {ethers.utils.formatEther(wave.prizeAmount)}</div>
              <div>Message: {wave.message}</div>
            </div>
          );
        })}
    </div>
  );
}

export default App;
