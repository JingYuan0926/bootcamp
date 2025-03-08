import { useState } from "react";
import dynamic from "next/dynamic";
import { useWallet, useAnchorWallet } from "@solana/wallet-adapter-react";
import WalletButton from "../components/WalletButton";

// Dynamically import the counter components with no SSR
// This prevents hydration errors with wallet adapters
const NativeCounter = dynamic(() => import("./nativecounter"), { ssr: false });
const AnchorCounter = dynamic(() => import("./anchorcounter"), { ssr: false });

export default function Home() {
  const [selectedTab, setSelectedTab] = useState("native");
  const wallet = useWallet();
  const anchorWallet = useAnchorWallet();

  // Handle wallet connection
  const handleWalletConnect = (wallet) => {
    console.log("Wallet connected in main component:", wallet.publicKey.toString());
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div className="flex border-b">
          <button 
            className={`py-2 px-4 mr-2 ${selectedTab === "native" ? "border-b-2 border-blue-500 font-bold" : ""}`}
            onClick={() => setSelectedTab("native")}
          >
            Native
          </button>
          <button 
            className={`py-2 px-4 mr-2 ${selectedTab === "anchor" ? "border-b-2 border-blue-500 font-bold" : ""}`}
            onClick={() => setSelectedTab("anchor")}
          >
            Anchor
          </button>
        </div>
        
        <div>
          <WalletButton onConnect={handleWalletConnect} />
        </div>
      </div>
      
      {/* Conditionally render the selected counter component */}
      <div className="counter-container">
        {selectedTab === "native" ? 
          <NativeCounter wallet={wallet} /> : 
          <AnchorCounter wallet={anchorWallet} />
        }
      </div>
    </div>
  );
}
