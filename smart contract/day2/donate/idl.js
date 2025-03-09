const IDL = {
    "version": "0.1.0",
    "name": "donation_events",
    "instructions": [
      {
        "name": "recordDonation",
        "accounts": [
          {
            "name": "donor",
            "isMut": true,
            "isSigner": true
          },
          {
            "name": "vault",
            "isMut": true,
            "isSigner": false
          },
          {
            "name": "systemProgram",
            "isMut": false,
            "isSigner": false
          }
        ],
        "args": [
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    ],
    "metadata": {
      "address": "HPHXtE7dhKP8R1iANQeTZiSFpYcpzmqjBz1CTTunfj4K"
    }
  }

export default IDL;