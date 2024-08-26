// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;


import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";
import {Types} from "./Types.sol";
import {Errors} from "./Errors.sol";
import {Typehash} from "./Typehash.sol";
import {StorageLib} from "./StorageLib.sol";
import {Events} from "./Events.sol";
import "hardhat/console.sol";


/**
 * @title MetaTxLib
 * @author CoreskyHub Protocol
 *
 * NOTE: the functions in this contract operate under the assumption that the passed signer is already validated
 * to either be the originator or one of their delegated executors.
 *
 * @dev User nonces are incremented from this library as well.
 */
library MetaTxLibUpgradeable {
    
    using ECDSA for bytes32;
    using ECDSA for bytes;
    
    uint256 constant POLYGON_CHAIN_ID = 137;
    string constant CORESKE_HUB = "CoreskyHub Protocol";
    string constant EIP712_DOMAIN_VERSION = "2";
    bytes32 constant EIP712_DOMAIN_VERSION_HASH = keccak256(bytes(EIP712_DOMAIN_VERSION));
    bytes4 constant EIP1271_MAGIC_VALUE = 0x1626ba7e;

    /**
     * @dev We store the domain separator and CoreskyHub Proxy address as constants to save gas.
     *
     * keccak256(
     *     abi.encode(
     *         keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'),
     *         keccak256('CoreskyHub Protocol'), // Contract Name
     *         keccak256('2'), // Version Hash
     *         137, // Polygon Chain ID
     *         address(this) // Verifying Contract Address - CoreskyHub Address
     *     )
     * );
     */
    function getDomainHash() public view returns (bytes32) {
        return calculateDomainSeparator();
    }

    function getNonce(address signer)
        internal view
        returns (uint256)
    {
        return StorageLib.nonces()[signer];
    }
    function verify(
        address signer,
        uint8 v,
        bytes32 r,
        bytes32 s,
        uint256 deadline,
        uint256 serialNo,
        address projectAddr,
        uint256 supportCount,
        uint256 opposeCount,
        uint256 voteRatio,
        uint256 expireTime
    ) internal view returns (bool){
        bytes memory input = abi.encode(
                    Typehash.ADD_PROPOSAL,
                    serialNo,
                    projectAddr,
                    supportCount,
                    opposeCount,
                    voteRatio,
                    expireTime,
                    0,
                    deadline
                );
        bytes32 digest = _calculateDigest(keccak256(input));
        address recoveredAddress = ecrecover(
            digest,
            v,
            r,
            s
        );
        if (recoveredAddress == address(0) || recoveredAddress != signer) {
            return false;
        }else{
            return true;
        }
    }

    function validateVoteSupportSignature(
        Types.EIP712Signature calldata signature,
        uint256 serialNo,
        address voteAddr,
        uint256 voteCount
    ) internal {
        uint256 nonce = _getNonceIncrementAndEmitEvent(signature.signer);
        _validateRecoveredAddress(
            _calculateDigest(
                keccak256(
                    abi.encode(
                        Typehash.VOTE_SUPPORT_PROPOSAL,
                        serialNo,
                        voteAddr,
                        voteCount,
                        nonce,
                        signature.deadline
                    )
                )
            ),
            signature
        );
    }

    function validateVoteOpposeSignature(
        Types.EIP712Signature calldata signature,
        uint256 serialNo,
        address voteAddr,
        uint256 voteCount
    ) internal {
        uint256 nonce = _getNonceIncrementAndEmitEvent(signature.signer);
        _validateRecoveredAddress(
            _calculateDigest(
                keccak256(
                    abi.encode(
                        Typehash.VOTE_OPPOSE_PROPOSAL,
                        serialNo,
                        voteAddr,
                        voteCount,
                        nonce,
                        signature.deadline
                    )
                )
            ),
            signature
        );
    }

    function validateVoteRefundSignature(
        Types.EIP712Signature calldata signature,
        uint256 roundID,
        uint256 serialNo,
        address voteAddr,
        uint256 voteCount
    ) internal {
        uint256 nonce = _getNonceIncrementAndEmitEvent(signature.signer);
        console.log("validateVoteRefundSignature: nonce:%s ", nonce);
        _validateRecoveredAddress(
            _calculateDigest(
                keccak256(
                    abi.encode(
                        Typehash.VOTE_REFUND_ALLOCATION,
                        roundID,
                        serialNo,
                        voteAddr,
                        voteCount,
                        nonce,
                        signature.deadline
                    )
                )
            ),
            signature
        );
    }

    function validateApNftMintSignature(
        Types.EIP712Signature calldata signature,
        uint256 roundID,
        address allocationAddr,
        uint256 mintNum
    ) internal {
        console.log("validateApNftMintSignature: roundID:%s, mintNum: %s ", roundID, mintNum);
        uint256 nonce = _getNonceIncrementAndEmitEvent(signature.signer);
        console.log("validateApNftMintSignature: nonce:%s ", nonce);
        _validateRecoveredAddress(
            _calculateDigest(
                keccak256(
                    abi.encode(
                        Typehash.APNFT_MINT_ALLOCATION,
                        roundID,
                        allocationAddr,
                        mintNum,
                        nonce,
                        signature.deadline
                    )
                )
            ),
            signature
        );
    }


    function validateAddProposalSignature(
        Types.EIP712Signature calldata signature,
        Types.Proposal memory proposal
    ) internal {
        uint256 nonce = _getNonceIncrementAndEmitEvent(signature.signer);
        _validateRecoveredAddress(
            _calculateDigest(
                keccak256(
                    abi.encode(
                        Typehash.ADD_PROPOSAL,
                        proposal.serialNo,
                        proposal.projectAddr,
                        proposal.supportCount,
                        proposal.opposeCount,
                        proposal.voteRatio,
                        proposal.expireTime,
                        nonce,
                        signature.deadline
                    )
                )
            ),
            signature
        );
    }

    /**
     * @dev recoveredSigner.
     */
    function recoveredSigner(
        uint256 apNftNo,
        string memory _name,
        string memory _symbol,
        string memory _baseUri,
        uint256 deadline,
        bytes memory signature
    ) internal view returns (address) {
        require(block.timestamp < deadline, "The sign deadline error");
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                Typehash.BOT_SIGN_DEPLOY_APNFT,
                apNftNo,
                _name,
                _symbol,
                _baseUri,
                deadline
            )
        );
        return messageHash.recover(signature);
    }

    /**
     * @dev recoveredSigner.
     */
    function recoveredSigner(
        Types.Proposal calldata proposal,
        uint256 deadline,
        bytes memory signature
    ) internal view returns (address) {
        require(block.timestamp < deadline, "The sign deadline error");
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
        return messageHash.recover(signature);
    }

    function validateSetProfileMetadataURISignature(
        Types.EIP712Signature calldata signature,
        uint256 serialNo,
        string calldata metadataURI
    ) internal {
        _validateRecoveredAddress(
            _calculateDigest(
                keccak256(
                    abi.encode(
                        Typehash.SET_APNFT_METADATA_URI,
                        serialNo,
                        _encodeUsingEip712Rules(metadataURI),
                        _getNonceIncrementAndEmitEvent(signature.signer),
                        signature.deadline
                    )
                )
            ),
            signature
        );
    }

    /// @dev This function is used to invalidate signatures by incrementing the nonce
    function incrementNonce(uint8 increment) internal {
        uint256 currentNonce = StorageLib.nonces()[msg.sender];
        StorageLib.nonces()[msg.sender] = currentNonce + increment;
        emit Events.NonceUpdated(
            msg.sender,
            currentNonce + increment,
            block.timestamp
        );
    }

    function calculateDomainSeparator() internal view returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    Typehash.EIP712_DOMAIN,
                    keccak256(bytes(CORESKE_HUB)),
                    EIP712_DOMAIN_VERSION_HASH,
                    block.chainid,
                    address(this)
                )
            );
    }

    /**
     * @dev Wrapper for ecrecover to reduce code size, used in meta-tx specific functions.
     */
    function _validateRecoveredAddress(
        bytes32 digest,
        Types.EIP712Signature calldata signature
    ) private view {
        if (block.timestamp > signature.deadline)
            revert Errors.SignatureExpired();
        // If the expected address is a contract, check the signature there.
        if (signature.signer.code.length != 0) {
            bytes memory concatenatedSig = abi.encodePacked(
                signature.r,
                signature.s,
                signature.v
            );
            if (
                IERC1271(signature.signer).isValidSignature(
                    digest,
                    concatenatedSig
                ) != EIP1271_MAGIC_VALUE
            ) {
                revert Errors.SignatureInvalid();
            }
        } else {
            address recoveredAddress = ecrecover(
                digest,
                signature.v,
                signature.r,
                signature.s
            );
            if (
                recoveredAddress == address(0) ||
                recoveredAddress != signature.signer
            ) {
                revert Errors.SignatureInvalid();
            }
        }
    }

    /**
     * @dev Calculates EIP712 digest based on the current DOMAIN_SEPARATOR.
     *
     * @param hashedMessage The message hash from which the digest should be calculated.
     *
     * @return bytes32 A 32-byte output representing the EIP712 digest.
     */
    function _calculateDigest(bytes32 hashedMessage)
        private
        view
        returns (bytes32)
    {
        return
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    calculateDomainSeparator(),
                    hashedMessage
                )
            );
    }

    /**
     * @dev This fetches a signer's current nonce and increments it so it's ready for the next meta-tx. Also emits
     * the `NonceUpdated` event.
     *
     * @param signer The address to get and increment the nonce for.
     *
     * @return uint256 The current nonce for the given signer prior to being incremented.
     */
    function _getNonceIncrementAndEmitEvent(address signer)
        private
        returns (uint256)
    {
        uint256 currentNonce;
        unchecked {
            currentNonce = StorageLib.nonces()[signer]++;
        }
        emit Events.NonceUpdated(signer, currentNonce + 1, block.timestamp);
        return currentNonce;
    }
    

    function _encodeUsingEip712Rules(bytes[] memory bytesArray)
        private
        pure
        returns (bytes32)
    {
        bytes32[] memory bytesArrayEncodedElements = new bytes32[](bytesArray.length);
        uint256 i;
        while (i < bytesArray.length) {
            // A `bytes` type is encoded as its keccak256 hash.
            bytesArrayEncodedElements[i] = _encodeUsingEip712Rules(bytesArray[i]);
            unchecked {
                ++i;
            }
        }
        // An array is encoded as the keccak256 hash of the concatenation of their encoded elements.
        return _encodeUsingEip712Rules(bytesArrayEncodedElements);
    }

    function _encodeUsingEip712Rules(bool[] memory boolArray)
        private
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(boolArray));
    }

    function _encodeUsingEip712Rules(address[] memory addressArray)
        private
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(addressArray));
    }

    function _encodeUsingEip712Rules(uint256[] memory uint256Array)
        private
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(uint256Array));
    }

    function _encodeUsingEip712Rules(bytes32[] memory bytes32Array)
        private
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(bytes32Array));
    }

    function _encodeUsingEip712Rules(string memory stringValue)
        private
        pure
        returns (bytes32)
    {
        return keccak256(bytes(stringValue));
    }

    function _encodeUsingEip712Rules(bytes memory bytesValue)
        private
        pure
        returns (bytes32)
    {
        return keccak256(bytesValue);
    }
}
