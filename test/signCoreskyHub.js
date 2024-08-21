const { network, ethers, upgrades } = require("hardhat");

const abi = require("ethereumjs-abi");
const ethUtil = require("ethereumjs-util");
const { BigNumber, utils } = require("ethers");
const { hexStripZeros, solidityPack, concat, toUtf8Bytes, keccak256, SigningKey, formatBytes32String, joinSignature } = utils;

const {
  SIGN_PUB,
  SIGN_PRI
} = process.env;

// TypeHash
const EIP712_DOMAIN = keccak256(toUtf8Bytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"));
const ADD_PROPOSAL = keccak256(
  toUtf8Bytes("addProposal(uint256 serialNo,address projectAddr,uint256 supportCount,uint256 opposeCount,uint256 voteRatio,uint256 expireTime,uint256 nonce,uint256 deadline)")
);
const SET_APNFT_METADATA_URI = keccak256(toUtf8Bytes("setApNFTMetadataURI(uint256 serialNo,string metadataURI,uint256 nonce,uint256 deadline)"));

const POLYGON_CHAIN_ID = 137;
const CORESKE_HUB = "CoreskyHub Protocol";
const EIP712_DOMAIN_VERSION = "2";
const EIP712_DOMAIN_VERSION_HASH = keccak256(toUtf8Bytes(EIP712_DOMAIN_VERSION));
const EIP1271_MAGIC_VALUE = 0x1626ba7e;

console.log("EIP712_DOMAIN_VERSION_HASH1", EIP712_DOMAIN_VERSION_HASH);
console.log("EIP712_DOMAIN_VERSION_HASH2", ethUtil.bufferToHex(ethUtil.keccakFromString(EIP712_DOMAIN_VERSION)));

const typedData = {
  types: {
    EIP712Domain: [
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "verifyingContract", type: "address" },
    ],
    addProposal: [
      { name: "serialNo", type: "uint256" },
      { name: "projectAddr", type: "address" },
      { name: "supportCount", type: "uint256" },
      { name: "opposeCount", type: "uint256" },
      { name: "voteRatio", type: "uint256" },
      { name: "expireTime", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  },
  primaryType: "addProposal",
  domain: {
    name: CORESKE_HUB,
    version: EIP712_DOMAIN_VERSION,
    chainId: POLYGON_CHAIN_ID,
    verifyingContract: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC",
  },
  message: {
    serialNo: "123456",
    projectAddr: "0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826",
    supportCount: "10",
    opposeCount: "5",
    voteRatio: "123456",
    expireTime: "123456",
    uint256: "1",
    deadline: "123456",
  },
};

const types = typedData.types;

// Recursively finds all the dependencies of a type
function dependencies(primaryType, found = []) {
  if (found.includes(primaryType)) {
    return found;
  }
  if (types[primaryType] === undefined) {
    return found;
  }
  found.push(primaryType);
  for (let field of types[primaryType]) {
    for (let dep of dependencies(field.type, found)) {
      if (!found.includes(dep)) {
        found.push(dep);
      }
    }
  }
  return found;
}

function encodeType(primaryType) {
  // Get dependencies primary first, then alphabetical
  let deps = dependencies(primaryType);
  deps = deps.filter((t) => t != primaryType);
  deps = [primaryType].concat(deps.sort());

  // Format as a string with fields
  let result = "";
  for (let type of deps) {
    result += `${type}(${types[type].map(({ name, type }) => `${type} ${name}`).join(",")})`;
  }
  return result;
}

function typeHash(primaryType) {
  console.log("typeHash", encodeType(primaryType));
  let typeHash = keccak256(toUtf8Bytes(encodeType(primaryType)));
  console.log("typeHash", typeHash);
  return typeHash;
}

function encodeData(primaryType, data) {
  let encTypes = [];
  let encValues = [];

  // Add typehash
  encTypes.push("bytes32");
  encValues.push(typeHash(primaryType));

  // Add field contents
  for (let field of types[primaryType]) {
    let value = data[field.name];
    if (field.type == "string" || field.type == "bytes") {
      encTypes.push("bytes32");
      value = ethUtil.keccakFromString(value);
      encValues.push(value);
    } else if (types[field.type] !== undefined) {
      encTypes.push("bytes32");
      value = ethUtil.keccak256(encodeData(field.type, value));
      encValues.push(value);
    } else if (field.type.lastIndexOf("]") === field.type.length - 1) {
      throw "TODO: Arrays currently unimplemented in encodeData";
    } else {
      encTypes.push(field.type);
      encValues.push(value);
    }
  }

  let abiEncode = abi.rawEncode(encTypes, encValues);
  console.log(ethUtil.bufferToHex(abiEncode));
  return abiEncode;
}

function structHash(primaryType, data) {
  return ethUtil.keccak256(encodeData(primaryType, data));
}

function signHash(messageHash, chainId, verifyContract) {
  let domain = {
    name: CORESKE_HUB,
    version: EIP712_DOMAIN_VERSION,
    chainId: chainId || POLYGON_CHAIN_ID,
    verifyingContract: verifyContract,
  };

  return ethUtil.bufferToHex(ethUtil.keccak256(Buffer.concat([Buffer.from("1901", "hex"), structHash("EIP712Domain", domain), messageHash])));
}

function signTypedData(chainId, verifyContract, type, message) {
  let domain = {
    name: CORESKE_HUB,
    version: EIP712_DOMAIN_VERSION,
    chainId: chainId || POLYGON_CHAIN_ID,
    verifyingContract: verifyContract,
  };
  let types;
  if (type === "addProposal") {
    types = {
      addProposal: [
        { name: "serialNo", type: "uint256" },
        { name: "projectAddr", type: "address" },
        { name: "supportCount", type: "uint256" },
        { name: "opposeCount", type: "uint256" },
        { name: "voteRatio", type: "uint256" },
        { name: "expireTime", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };
  } else if (type === "voteSupport") {
    types = {
      voteSupport: [
        { name: "serialNo", type: "uint256" },
        { name: "voteAddr", type: "address" },
        { name: "voteCount", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };
  } else if (type === "voteOppose") {
    types = {
      voteOppose: [
        { name: "serialNo", type: "uint256" },
        { name: "voteAddr", type: "address" },
        { name: "voteCount", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };
  } else if (type === "refundFundraisingVote") {
    types = {
      refundFundraisingVote: [
        { name: "roundID", type: "uint256" },
        { name: "serialNo", type: "uint256" },
        { name: "voteAddr", type: "address" },
        { name: "voteCount", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };
  } else if (type === "apNftMint") {
    types = {
      apNftMint: [
        { name: "roundID", type: "uint256" },
        { name: "allocationAddr", type: "address" },
        { name: "mintNum", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };
  }
  let msgParams = {
    domain,
    types: types,
    message,
  };

  return msgParams;
}

const BOT_SIGN_PROJECT_VOTE = keccak256(toUtf8Bytes('projectVoting(uint256 serialNo,address projectAddr,uint256 supportCount,uint256 opposeCount,uint256 voteRatio,uint256 expireTime,uint256 nonce,uint256 deadline)'));
const BOT_SIGN_DEPOSIT = keccak256(toUtf8Bytes('deposit(uint256 serialNo,address token,uint256 amount,uint256 deadline)'));
const BOT_SIGN_DEPLOY_APNFT = keccak256(toUtf8Bytes('deployApNFT(uint256 apNftNo,string name,string symbol,string baseUri,uint256 deadline)'));
const signPublicKey = SIGN_PUB;
const signPrivateKey = SIGN_PRI;

async function signDeployApNFT(apNftNo, name, symbol, baseUri, deadline){
  let digest;
    /**
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                Typehash.BOT_SIGN_DEPLOY_APNFT,
                apNftNo,
                _name,
                _symbol,
                _baseUri,
                deadline
            )
     */
    digest = keccak256(
      // utils.defaultAbiCoder.encode(
        utils.solidityPack(
          ['bytes32', 'uint256', 'string', 'string', 'string', 'uint256'],
          [BOT_SIGN_DEPLOY_APNFT,apNftNo, name, symbol, baseUri, deadline]
      )
    );
    console.log("ddigesta:", utils.solidityPack(
      ['bytes32', 'uint256', 'string', 'string', 'string', 'uint256'],
      [BOT_SIGN_DEPLOY_APNFT,apNftNo, name, symbol, baseUri, deadline]
  ))
  

  console.log("sign addr:", signPublicKey);
  console.log("sign privateKey:", signPrivateKey);
  // const signature = await admin.signMessage(digest);
  const signingKey = new SigningKey(signPrivateKey);
  const signature = joinSignature(signingKey.signDigest(digest));

  console.log("signature:",signature)
  return signature;
}

async function signProjectVote(serialNo, projectAddr, supportCount, opposeCount, voteRatio, expireTime, deadline){
  let digest;
    /**
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                Typehash.BOT_SIGN_PROJECT_VOTE,
                proposal.serialNo,
                proposal.projectAddr,
                proposal.supportCount,
                proposal.opposeCount,
                proposal.voteRatio,
                proposal.expireTime,
                deadline
            )
        );
     */
    digest = keccak256(
      // utils.defaultAbiCoder.encode(
        utils.solidityPack(
          ['bytes32', 'uint256', 'address', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256'],
          [BOT_SIGN_PROJECT_VOTE, serialNo, projectAddr, supportCount, opposeCount, voteRatio, expireTime, deadline]
      )
    );
    console.log("ddigesta:",utils.solidityPack(
      ['bytes32', 'uint256', 'address', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256'],
      [BOT_SIGN_PROJECT_VOTE, serialNo, projectAddr, supportCount, opposeCount, voteRatio, expireTime, deadline]
  ))
  

  console.log("sign addr:", signPublicKey);
  console.log("sign privateKey:", signPrivateKey);
  // const signature = await admin.signMessage(digest);
  const signingKey = new SigningKey(signPrivateKey);
  const signature = joinSignature(signingKey.signDigest(digest));

  console.log("signature:",signature)
  return signature;
}

async function signDeposit(serialNo, token, amount,deadline){
  let digest;
    /**
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                BOT_SIGN_DEPOSIT,
                serialNo,
                token,
                amount,
                deadline
            )
        );
     */
    digest = keccak256(
      // utils.defaultAbiCoder.encode(
        utils.solidityPack(
          ['bytes32', 'uint256', 'address', 'uint256', 'uint256'],
          [BOT_SIGN_DEPOSIT, serialNo, token, amount, deadline]
      )
    );
    console.log("ddigesta:",utils.solidityPack(
      ['bytes32', 'uint256', 'address', 'uint256', 'uint256'],
      [BOT_SIGN_DEPOSIT, serialNo, token, amount, deadline]
  ))
  

  console.log("sign addr:", signPublicKey);
  console.log("sign privateKey:", signPrivateKey);
  // const signature = await admin.signMessage(digest);
  const signingKey = new SigningKey(signPrivateKey);
  const signature = joinSignature(signingKey.signDigest(digest));

  console.log("signature:",signature)
  return signature;
}


module.exports = {
  structHash,
  signHash,
  signTypedData,
  signProjectVote,
  signDeposit,
  signDeployApNFT,
};
