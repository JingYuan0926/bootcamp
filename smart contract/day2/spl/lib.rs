use anchor_lang::prelude::*;
use anchor_lang::system_program::{Transfer, transfer, System};
use anchor_lang::solana_program::system_instruction;
use anchor_lang::solana_program::program::invoke;
use anchor_spl::token::{self, Token, TokenAccount, Mint, MintTo, InitializeMint};
use anchor_spl::associated_token::{self, AssociatedToken, Create};

// Make sure this ID matches the one in your frontend (advancedonate.js)
declare_id!("A9REH6DTms1Jxzj3csutdn1wpBdCk9yBHNxAdrx4H5K5");

#[program]
pub mod spl_token_demo {
    use super::*;

    // Simple function to mint tokens to the user's wallet
    pub fn mint_tokens(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
        // Mint tokens to user
        let cpi_accounts = MintTo {
            mint: ctx.accounts.token_mint.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.mint_authority.to_account_info(),
        };
        
        // Generate signer seeds for the mint authority PDA
        let seeds = &[b"mint_authority", &[ctx.bumps.mint_authority]];
        let signer_seeds = &[&seeds[..]];
        
        // Create CPI context with signer seeds for the PDA
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(
            cpi_program, 
            cpi_accounts, 
            signer_seeds
        );
        
        // Execute mint instruction
        token::mint_to(cpi_ctx, amount)?;
        
        // Log the event
        msg!(
            "TOKEN_MINT_EVENT: recipient={}, amount={}", 
            ctx.accounts.user.key(),
            amount
        );
        
        Ok(())
    }
}

#[derive(Accounts)]
pub struct MintTokens<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    // Token mint using PDA for deterministic address
    #[account(
        init_if_needed,
        payer = user,
        seeds = [b"spacex_token_mint"],
        bump,
        mint::decimals = 6,
        mint::authority = mint_authority,
    )]
    pub token_mint: Account<'info, Mint>,
    
    // User's token account - created automatically if it doesn't exist
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = token_mint,
        associated_token::authority = user,
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    
    // Mint authority PDA
    #[account(
        seeds = [b"mint_authority"],
        bump,
    )]
    /// CHECK: This is a PDA used as the mint authority
    pub mint_authority: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

impl<'info> MintTokens<'info> {
    // Helper property to check if mint is already initialized
    pub fn is_mint_initialized(&self) -> bool {
        self.token_mint.mint_authority.is_some()
    }
    
    // Helper property to check if token account already exists
    pub fn has_token_account(&self) -> bool {
        self.user_token_account.owner == self.user.key()
    }
}