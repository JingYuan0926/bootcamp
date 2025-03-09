use anchor_lang::prelude::*;
use anchor_lang::system_program::{Transfer, transfer, System};
use anchor_lang::solana_program::system_instruction;
use anchor_lang::solana_program::program::invoke;
use anchor_spl::token::{self, Token, TokenAccount, Mint, MintTo, InitializeMint};
use anchor_spl::associated_token::{self, AssociatedToken, Create};

// Make sure this ID matches the one in your frontend (advancedonate.js)
declare_id!("8nHBsGKFYE7uZ4QtnyTv4nJkhH2thC7XGNyg4xjf8Rwb");

#[program]
pub mod donation_events {
    use super::*;

    pub fn record_donation(ctx: Context<RecordDonation>, amount: u64) -> Result<()> {
        // Transfer SOL from donor to vault
        let ix = system_instruction::transfer(
            ctx.accounts.donor.key,
            ctx.accounts.vault.key,
            amount
        );
        
        invoke(
            &ix,
            &[
                ctx.accounts.donor.to_account_info(),
                ctx.accounts.vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ]
        )?;

        // Check if we need to initialize the mint
        if !ctx.accounts.is_mint_initialized {
            // Initialize mint
            msg!("Initializing SpaceX token mint");
            
            // Initialize the mint with 6 decimals
            let cpi_context = CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                InitializeMint {
                    mint: ctx.accounts.spacex_mint.to_account_info(),
                    rent: ctx.accounts.rent.to_account_info(),
                },
            );
            
            token::initialize_mint(
                cpi_context, 
                6, 
                &ctx.accounts.mint_authority.key(), 
                Some(&ctx.accounts.mint_authority.key())
            )?;
            
            // Create associated token account if it doesn't exist
            if !ctx.accounts.has_token_account {
                msg!("Creating user token account");
                let cpi_accounts = Create {
                    payer: ctx.accounts.donor.to_account_info(),
                    associated_token: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.donor.to_account_info(),
                    mint: ctx.accounts.spacex_mint.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                    rent: ctx.accounts.rent.to_account_info(),
                };
                
                let cpi_program = ctx.accounts.associated_token_program.to_account_info();
                let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
                associated_token::create(cpi_ctx)?;
            }
        }

        // Calculate tokens to mint (1 token per 0.001 SOL)
        let spacex_tokens_to_mint = amount / 1_000_000; 
        
        // Mint tokens
        let cpi_accounts = MintTo {
            mint: ctx.accounts.spacex_mint.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.mint_authority.to_account_info(),
        };
        
        let seeds = &[b"mint_authority", &[ctx.bumps.mint_authority]];
        let signer_seeds = &[&seeds[..]];
        
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(
            cpi_program, 
            cpi_accounts, 
            signer_seeds
        );
        
        token::mint_to(cpi_ctx, spacex_tokens_to_mint)?;
        
        // Log event
        let clock = Clock::get()?;
        msg!(
            "DONATION_EVENT: donor={}, amount={}, timestamp={}, tokens={}",
            ctx.accounts.donor.key(),
            amount,
            clock.unix_timestamp,
            spacex_tokens_to_mint
        );
        
        Ok(())
    }
}

#[derive(Accounts)]
pub struct RecordDonation<'info> {
    #[account(mut)]
    pub donor: Signer<'info>,
    
    /// CHECK: Vault PDA to receive donations
    #[account(
        mut,
        seeds = [b"donation_vault"],
        bump
    )]
    pub vault: AccountInfo<'info>,
    
    // SpaceX token mint - using PDA so we don't need a separate signer
    #[account(
        init_if_needed,
        payer = donor,
        seeds = [b"spacex_token_mint"],
        bump,
        mint::decimals = 6,
        mint::authority = mint_authority,
    )]
    pub spacex_mint: Account<'info, Mint>,
    
    // User's token account - will be created if it doesn't exist
    #[account(
        init_if_needed,
        payer = donor,
        associated_token::mint = spacex_mint,
        associated_token::authority = donor,
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    
    /// CHECK: Mint authority PDA
    #[account(
        seeds = [b"mint_authority"],
        bump,
    )]
    pub mint_authority: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

impl<'info> RecordDonation<'info> {
    // Helper property to check if mint is already initialized
    pub fn is_mint_initialized(&self) -> bool {
        self.spacex_mint.mint_authority.is_some()
    }
    
    // Helper property to check if token account already exists
    pub fn has_token_account(&self) -> bool {
        self.user_token_account.owner == self.donor.key()
    }
}