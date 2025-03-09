use anchor_lang::prelude::*;
use anchor_lang::system_program::{Transfer, transfer, System};

declare_id!("HPHXtE7dhKP8R1iANQeTZiSFpYcpzmqjBz1CTTunfj4K");

#[program]
pub mod donation_events {
    use super::*;

    pub fn record_donation(ctx: Context<RecordDonation>, amount: u64) -> Result<()> {
        // Transfer SOL from donor to vault
        let transfer_instruction = Transfer {
            from: ctx.accounts.donor.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
        };

        transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                transfer_instruction,
            ),
            amount,
        )?;
        
        let clock = Clock::get()?;
        
        msg!(
            "DONATION_EVENT: donor={}, amount={}, timestamp={}", 
            ctx.accounts.donor.key(),
            amount,
            clock.unix_timestamp
        );
        
        Ok(())
    }
}

#[derive(Accounts)]
pub struct RecordDonation<'info> {
    #[account(mut)]
    pub donor: Signer<'info>,
    /// CHECK: This is the PDA that will receive the donations
    #[account(
        mut,
        seeds = [b"donation_vault"],
        bump
    )]
    pub vault: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}