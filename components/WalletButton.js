import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import dynamic from 'next/dynamic';
import { useEffect } from 'react';

const WalletMultiButtonDynamic = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
);

const WalletButton = ({ onConnect }) => {
  const wallet = useWallet();
  
  // Pass the wallet to the parent component when connected (if onConnect is provided)
  useEffect(() => {
    if (wallet.connected && wallet.publicKey && typeof onConnect === 'function') {
      onConnect(wallet);
    }
  }, [wallet.connected, wallet.publicKey, onConnect]);

  return (
    <div>
      <WalletMultiButtonDynamic className="px-4 py-2 rounded border border-gray-300" />
      {wallet.connected && <p className="mt-2 text-sm text-green-600">Wallet connected!</p>}
    </div>
  );
};

export default WalletButton; 