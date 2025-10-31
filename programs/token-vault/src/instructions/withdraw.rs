use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;

use anchor_spl::token_interface::{Mint, TokenInterface, TokenAccount, TransferChecked, transfer_checked};

use crate::state::VaultState;
use crate::error::Errors;

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut, 
        associated_token::mint = mint,
        associated_token::authority = owner,
        associated_token::token_program = token_program
    )]
    pub associate_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,

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

    pub system_program: Program<'info, System>,

    pub associated_token_program: Program<'info, AssociatedToken>
}

impl<'info> Withdraw<'info> {
    pub fn withdraw(&mut self) -> Result<()> {
        require!(self.state.amount <= self.vault.amount, Errors::TargetAmountNotReached);

        let cpi_program = self.token_program.to_account_info();

        let cpi_accounts = TransferChecked{
            mint: self.mint.to_account_info(),
            from: self.vault.to_account_info(),
            authority: self.state.to_account_info(),
            to: self.associate_token_account.to_account_info(),
        };
        let seeds = &[
            b"state",
            self.owner.to_account_info().key.as_ref(),
            self.mint.to_account_info().key.as_ref(),
            &[self.state.state_bump]
        ];

        let signer_seeds = &[&seeds[..]];

        let cpi_context = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);

        transfer_checked(cpi_context, self.vault.amount, self.mint.decimals)?;

        Ok(())
    }
}
