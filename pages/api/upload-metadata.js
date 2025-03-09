import { ObjectManager } from "@filebase/sdk";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { metadata } = req.body;

  // Filebase credentials - store these in environment variables
  const S3_KEY = process.env.FILEBASE_KEY;
  const S3_SECRET = process.env.FILEBASE_SECRET;
  const BUCKET_NAME = process.env.FILEBASE_BUCKET;

  try {
    // Create a new instance of the ObjectManager
    const objectManager = new ObjectManager(S3_KEY, S3_SECRET, {
      bucket: BUCKET_NAME
    });
    
    // Generate a unique file name using timestamp
    const fileName = `metadata-${Date.now()}.json`;
    
    // Upload the metadata as JSON
    const uploadedObject = await objectManager.upload(
      fileName,
      Buffer.from(JSON.stringify(metadata))
    );
    
    // Return the IPFS URI
    return res.status(200).json({ 
      metadataUri: `https://ipfs.filebase.io/ipfs/${uploadedObject.cid}`
    });
  } catch (error) {
    console.error("Error uploading to Filebase:", error);
    return res.status(500).json({ error: error.message });
  }
}