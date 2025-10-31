use anchor_lang::prelude::*;

#[error_code]
pub enum Errors {
    #[msg("Deposit amount is invalid")]
    InvalidDepositAmount,

    #[msg("Target amount is not reached")]
    TargetAmountNotReached,
}
