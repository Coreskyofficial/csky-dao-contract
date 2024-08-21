const { network, ethers, upgrades } = require('hardhat');
const { zeroAddress } = require("ethereumjs-util");
const { BigNumber, utils } = require("ethers");
const {
  hexStripZeros,
  solidityPack,
  concat,
  toUtf8Bytes,
  keccak256,
  SigningKey,
  formatBytes32String,
  joinSignature,
} = utils;

require("dotenv").config();
const {
    ALCHEMY_API_KEY,
    INFURA_API_KEY,
    GOERLI_PRIVATE_KEY1,
    GOERLI_PRIVATE_KEY2,
    ETHERSCAN_API_KEY,
    BSCSCAN_API_KEY,
    ETH_PK_2,
    ETH_PK_3,
    ETH_PK_4,
    POLYGON_MUMBAISCAN_API_KEY,
    SIGN_PUB,
    SIGN_PRI
  
  
  } = process.env;
  

const PROVENANCE = "CoreSBT-Polygon";
// Method name
const MINT_METHOD = "mint";
const BURN_METHOD = "burn";
const UPDATE_AMOUNT_METHOD = "updateAmount"; 

async function sign(type, _to, tokenId, deadline,  amount,  value, serialNo){
  let digest;
  if(type == 'mint'){
    /**
     * function verifyMint(
      address _to,
      uint256 deadline,
      uint256 amount,
      uint256 value,
      uint256 serialNo,
      bytes memory signature
  ) 
  bytes32 messageHash = keccak256(
    abi.encodePacked(
        PROVENANCE,
        _to,
        deadline,
        amount,
        value,
        serialNo,
        MINT_METHOD
    )
);
     */
    digest = keccak256(
      utils.solidityPack(
          ['string', 'address', 'uint256', 'uint256', 'uint256', 'uint256', 'string'],
          [PROVENANCE, _to, deadline, amount, value, serialNo, MINT_METHOD]
      )
    );
    console.log("ddigesta:",
      [PROVENANCE, _to, deadline, amount, value, serialNo, MINT_METHOD]
  )
    // digest = utils.keccak256(_to);
    console.log("ddigesta:",utils.solidityPack(
      ['string', 'address', 'uint256', 'uint256', 'uint256', 'uint256', 'string'],
      [PROVENANCE, _to, deadline, amount, value, serialNo, MINT_METHOD]
  ))
  } else if(type == 'burn'){
    /**
     * function verifyBurn(
      address _to,
      uint256 _tokenId,
      uint256 deadline,
      uint256 serialNo,
      bytes memory signature
  )
    bytes32 messageHash = keccak256(
          abi.encodePacked(PROVENANCE, _to, _tokenId, deadline, serialNo, BURN_METHOD)
      );
     */
    digest = keccak256(
      // utils.defaultAbiCoder.encode(
        utils.solidityPack(
          ['string', 'address', 'uint256', 'uint256', 'uint256', 'string'],
          [PROVENANCE, _to, tokenId, deadline, serialNo, BURN_METHOD]
      )
    );
    console.log("ddigesta:",utils.solidityPack(
      ['string', 'address', 'uint256', 'uint256', 'uint256', 'string'],
      [PROVENANCE, _to, tokenId, deadline, serialNo, BURN_METHOD]
  ))
  }  else {
    /**
     * function verifyUpdateAmount(
     * 
      address _to,
      uint256 tokenId,
      uint256 deadline,
      uint256 amount,
      uint256 serialNo,
      bytes memory signature
  )
  bytes32 messageHash = keccak256(
          abi.encodePacked(
              PROVENANCE,
              _to,
              tokenId,
              deadline,
              amount,
              serialNo,
              UPDATE_AMOUNT_METHOD
          )
      );
     */
    digest = keccak256(
      // utils.defaultAbiCoder.encode(
        utils.solidityPack(
          ['string', 'address', 'uint256', 'uint256', 'uint256', 'uint256', 'string'],
          [PROVENANCE, _to, tokenId, deadline, amount, serialNo, UPDATE_AMOUNT_METHOD]
      )
    );
    console.log("ddigesta:",utils.solidityPack(
      ['string', 'address', 'uint256', 'uint256', 'uint256', 'uint256', 'string'],
      [PROVENANCE, _to, tokenId, deadline, amount, serialNo, UPDATE_AMOUNT_METHOD]
  ))
  }

  console.log("sign addr:", signPublicKey);
  console.log("sign privateKey:", signPrivateKey);
  // const signature = await admin.signMessage(digest);
  const signingKey = new SigningKey(signPrivateKey);
  const signature = joinSignature(signingKey.signDigest(digest));

  console.log("signature:",signature)
  return signature;
}

// ==============================================

let signPublicKey = SIGN_PUB;
let signPrivateKey = SIGN_PRI;


let _to = "0x30296d2C91B60DdC8ED76beeEE3ECAAa9CF4F9a1";
let now = parseInt(new Date().getTime() / 1000) + 50;
let deadline = now;
let amount = 1;
let value = 0;
let serialNo = now;

const signature = sign("", _to, 2, deadline,  amount,  value, serialNo);

console.log("signature:",signature)