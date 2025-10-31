use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::error::Errors;
use crate::state::VaultState;

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        seeds = [b"state".as_ref(), owner.key().as_ref(), mint.key().as_ref()],
        bump = state.state_bump
    )]
    pub state: Account<'info, VaultState>,

    #[account(
        mut,
        seeds = [b"vault".as_ref(), state.key().as_ref(), mint.key().as_ref()],
        bump = state.vault_bump
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = owner,
        associated_token::token_program = token_program
    )]
    pub token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,

    pub system_program: Program<'info, System>,

    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> Deposit<'info> {
    pub fn deposit(&mut self, amount: u64) -> Result<()> {
        require!(amount > 0, Errors::InvalidDepositAmount);

        let cpi_program = self.token_program.to_account_info();

        let cpi_accounts = TransferChecked {
            mint: self.mint.to_account_info(),
            from: self.token_account.to_account_info(),
            to: self.vault.to_account_info(),
            authority: self.owner.to_account_info(),
        };

        let cpi_context = CpiContext::new(cpi_program, cpi_accounts);

        transfer_checked(cpi_context, amount, self.mint.decimals)?;

        Ok(())
    }
}
