import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import dynamic from "next/dynamic";
import { FiExternalLink } from "react-icons/fi";
import {
  Button,
  Card,
  CardBody,
  Input,
  Progress,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Textarea,
} from "@nextui-org/react";
import WalletButton from "../components/WalletButton";
import { 
  generateSigner, 
  createGenericFile,
  sol
} from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplCore, create } from "@metaplex-foundation/mpl-core";
import { base58 } from "@metaplex-foundation/umi/serializers";
import { createSignerFromWalletAdapter } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { signerIdentity } from "@metaplex-foundation/umi";

// The wallet adapter utility function (moved from utils/wallet-adapter.js)
const createUmiWithWalletAdapter = (umi, wallet) => {
  if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) {
    throw new Error('Wallet not connected or does not support required signing methods');
  }

  // Create a signer from the wallet adapter
  const signer = createSignerFromWalletAdapter(wallet);
  
  // Use the signer as the identity
  return umi.use(signerIdentity(signer));
};

export default function NFTPage() {
  const wallet = useWallet();
  const { publicKey, connected } = wallet;
  
  const [nftName, setNftName] = useState("My Solana NFT");
  const [nftDescription, setNftDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [mintStatus, setMintStatus] = useState("");
  const [mintedNFT, setMintedNFT] = useState(null);
  const [error, setError] = useState(null);

  // Handle wallet connection
  const handleWalletConnect = (connectedWallet) => {
    console.log("Wallet connected:", connectedWallet.publicKey.toString());
  };

  const handleImageUrlChange = (e) => {
    const url = e.target.value;
    setImageUrl(url);
    setPreviewUrl(url);
  };

  // Upload metadata JSON to Filebase via API route
  const uploadMetadataToFilebase = async (metadata) => {
    try {
      setMintStatus("Uploading metadata to Filebase...");
      
      const response = await fetch("/api/upload-metadata", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ metadata }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload metadata");
      }
      
      const data = await response.json();
      console.log("Uploaded metadata to Filebase:", data);
      
      return data.metadataUri;
    } catch (error) {
      console.error("Error uploading to Filebase:", error);
      throw new Error(`Filebase upload failed: ${error.message}`);
    }
  };

  // Create NFT using Metaplex Core
  const mintNFT = async () => {
    if (!connected) {
      setMintStatus("Please connect your wallet first");
      return;
    }
  
    if (!nftName || !imageUrl) {
      setMintStatus("Please fill in both name and image URL");
      return;
    }
  
    setLoading(true);
    setMintStatus("Starting NFT minting process...");
  
    try {
      console.log("Starting NFT minting process...");

      // Create metadata JSON
      const metadata = {
        name: nftName,
        description: nftDescription || "A Solana NFT created with Filebase IPFS storage",
        image: imageUrl,
        external_url: "",
        attributes: [],
        properties: {
          files: [{
            uri: imageUrl,
            type: "image/jpeg"
          }],
          category: "image"
        }
      };
      
      // Upload metadata to Filebase and get URI
      const metadataUri = await uploadMetadataToFilebase(metadata);
      console.log("Metadata URI:", metadataUri);
      setMintStatus(`Metadata uploaded to: ${metadataUri}`);
      
      // Initialize Umi with Metaplex Core
      setMintStatus("Initializing Solana connection...");
      
      const umi = createUmi("https://api.devnet.solana.com")
        .use(mplCore());
      
      try {
        // Use our utility function to set up wallet adapter as signer
        createUmiWithWalletAdapter(umi, wallet);
      } catch (err) {
        console.error("Error setting up wallet adapter:", err);
        throw new Error("Failed to set up wallet with Metaplex: " + err.message);
      }
      
      // Generate a signer for the asset
      const asset = generateSigner(umi);
      console.log("Generated asset address:", asset.publicKey);
      setMintStatus(`Generated asset address: ${asset.publicKey}`);
      
      // Create NFT
      setMintStatus("Creating NFT on Solana...");
      const tx = await create(umi, {
        asset,
        name: nftName,
        uri: metadataUri,
      }).sendAndConfirm(umi);
      
      // Get transaction signature
      const signature = base58.deserialize(tx.signature)[0];
      console.log("Transaction signature:", signature);
      
      setMintedNFT({
        assetAddress: asset.publicKey,
        signature: signature,
        metadataUri: metadataUri
      });
      
      setMintStatus("NFT minted successfully!");
    } catch (error) {
      console.error("Error minting NFT:", error);
      setMintStatus(`Error minting NFT: ${error.message}`);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-8 font-sans">
      <h1 className="text-4xl text-gray-700 mb-8 text-center">
        Solana NFT Minter with Metaplex Core
      </h1>
      
      <div className="flex flex-col items-center mb-8">
        <WalletButton onConnect={handleWalletConnect} />
        {connected && (
          <p className="mt-2 text-emerald-600 font-bold">
            Connected: {publicKey.toString().slice(0, 8)}...
          </p>
        )}
      </div>

      <div className="bg-gray-50 rounded-lg p-8 shadow-md">
        <div className="mb-6">
          <label className="block mb-2 font-bold text-gray-600">
            NFT Name
          </label>
          <Input
            value={nftName}
            onChange={(e) => setNftName(e.target.value)}
            placeholder="Enter NFT name"
            disabled={loading}
            className="w-full"
          />
        </div>
        
        <div className="mb-6">
          <label className="block mb-2 font-bold text-gray-600">
            NFT Description
          </label>
          <Textarea
            value={nftDescription}
            onChange={(e) => setNftDescription(e.target.value)}
            placeholder="Enter NFT description"
            disabled={loading}
            rows={3}
            className="w-full resize-none"
          />
        </div>
        
        <div className="mb-6">
          <label className="block mb-2 font-bold text-gray-600">
            NFT Image URL
          </label>
          <Input
            type="url"
            value={imageUrl}
            onChange={handleImageUrlChange}
            placeholder="Enter image URL"
            disabled={loading}
            className="w-full mb-4"
          />
          
          {previewUrl && (
            <div className="p-4 border border-gray-300 rounded-md bg-gray-100">
              <img
                src={previewUrl}
                alt="NFT preview"
                className="max-w-full max-h-[200px] rounded-md mx-auto"
              />
              <p className="mt-2 text-center text-gray-500">Preview of your NFT image</p>
            </div>
          )}
        </div>
        
        <Button
          onClick={mintNFT}
          disabled={!connected || loading}
          color="primary"
          className="w-full py-6"
        >
          {loading ? "Minting..." : "Mint NFT"}
        </Button>
        
        {mintStatus && (
          <div className="mt-4 p-4 rounded-md bg-gray-100 font-medium">
            {mintStatus}
          </div>
        )}
        
        {mintedNFT && (
          <div className="mt-4 p-4 rounded-md bg-emerald-500 text-white font-medium">
            <p className="mb-2">NFT Minted Successfully!</p>
            <p className="mb-2">Asset Address: {mintedNFT.assetAddress}</p>
            <p className="mb-2">Transaction Signature: {mintedNFT.signature}</p>
            <p className="mb-2">Metadata URI: {mintedNFT.metadataUri}</p>
            <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-2 sm:space-y-0 mt-4">
              <a 
                href={`https://explorer.solana.com/tx/${mintedNFT.signature}?cluster=devnet`} 
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-4 py-2 bg-white text-emerald-500 rounded-md font-bold no-underline hover:bg-gray-50 text-center"
              >
                View Transaction
              </a>
              <a 
                href={`https://core.metaplex.com/explorer/${mintedNFT.assetAddress}?env=devnet`} 
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-4 py-2 bg-white text-emerald-500 rounded-md font-bold no-underline hover:bg-gray-50 text-center"
              >
                View on Metaplex
              </a>
              <a 
                href={mintedNFT.metadataUri} 
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-4 py-2 bg-white text-emerald-500 rounded-md font-bold no-underline hover:bg-gray-50 text-center"
              >
                View Metadata
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 