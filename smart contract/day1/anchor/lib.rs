use anchor_lang::prelude::*;

declare_id!("11111111111111111111111111111111"); // Playground will replace this

#[program]
pub mod counter {
    use super::*;

    // Initialize a new counter
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count = 0;
        msg!("Counter initialized to 0");
        Ok(())
    }

    // Increment the counter
    pub fn increment(ctx: Context<Update>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count += 1;
        msg!("Counter incremented to {}", counter.count);
        Ok(())
    }

    // Decrement the counter
    pub fn decrement(ctx: Context<Update>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count = counter.count.saturating_sub(1);
        msg!("Counter decremented to {}", counter.count);
        Ok(())
    }

    // View the counter (this doesn't modify state but is included for completeness)
    pub fn view(ctx: Context<View>) -> Result<()> {
        let counter = &ctx.accounts.counter;
        msg!("Current count: {}", counter.count);
        Ok(())
    }
}

// Counter account structure
#[account]
pub struct Counter {
    pub count: u32,
}

// Context for initializing a counter
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = user, space = 8 + 4)]
    pub counter: Account<'info, Counter>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// Context for updating a counter
#[derive(Accounts)]
pub struct Update<'info> {
    #[account(mut)]
    pub counter: Account<'info, Counter>,
}

// Context for viewing a counter
#[derive(Accounts)]
pub struct View<'info> {
    pub counter: Account<'info, Counter>,
}
