// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0;

library Errors {
    
    error ApNftDoesNotExist();
    error ApNftExist();
    error AllocationExist();
    error AllocationDoesNotExist();
    error IssutTokenDoesNotExist();
    error NotSupportingCurrentChain();
    error CoreskyAirDropDoesNotExist();
    error PreSaleDataDoseNotExist();
    error AlreadyMint();
    error MinNotStarted();
    error MintHasEnded();
    
    error InvalidReceipt();
    
    error InvalidPreSaleIDsArrayIsEmpty();
    error ExceedMaxMint100();

    error InvalidSerialNoEmpty();
    error InvalidProjectAddrEmpty();
    error ApplyProjectVoteAlreadyExists();
    
    error InitParamsInvalid();
    error BotSignatureInvalid();
    error SignatureExpired();
    error SignatureInvalid();

    error CannotInitImplementation();
    error Initialized();
    
    error ResetAfterTimeExpires();


}
