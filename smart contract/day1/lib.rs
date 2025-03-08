use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
};
use borsh::{BorshDeserialize, BorshSerialize};

/// Define the type of state stored in accounts
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct Counter {
    pub count: u32,
}

// Implement methods for Counter
impl Counter {
    // Create a new counter initialized to zero
    pub fn new() -> Self {
        Counter { count: 0 }
    }

    // Increment the counter
    pub fn increment(&mut self) {
        self.count += 1;
    }

    // Decrement the counter
    pub fn decrement(&mut self) {
        if self.count > 0 {
            self.count -= 1;
        }
    }

    // Get the space required for storing this struct
    pub fn get_space() -> usize {
        std::mem::size_of::<Self>()
    }
}

// Declare and export the program's entrypoint
entrypoint!(process_instruction);

// Helper function to get or initialize the counter
fn get_or_init_counter(account: &AccountInfo) -> Result<Counter, ProgramError> {
    // Try to deserialize the account data
    match Counter::try_from_slice(&account.data.borrow()) {
        // If successful, return the counter
        Ok(counter) => Ok(counter),
        // If deserialization fails, assume the account is new and initialize it
        Err(_) => {
            msg!("Initializing new counter");
            Ok(Counter::new())
        }
    }
}

// Program entrypoint's implementation
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    // Get the data account
    let account = next_account_info(&mut accounts.iter())?;
    
    // Check account ownership
    if account.owner != program_id {
        return Err(ProgramError::IncorrectProgramId);
    }

    // Check if the account has enough space
    let space_needed = Counter::get_space();
    if account.data_len() < space_needed {
        msg!("Account data too small. Need {} bytes", space_needed);
        return Err(ProgramError::AccountDataTooSmall);
    }

    // Get the instruction code from the first byte
    if instruction_data.is_empty() {
        return Err(ProgramError::InvalidInstructionData);
    }
    
    let instruction_code = instruction_data[0];

    if instruction_code == 1 {
        // Increment counter
        let mut counter = get_or_init_counter(account)?;
        counter.increment();
        counter.serialize(&mut *account.data.borrow_mut())?;
        msg!("Counter incremented to {}", counter.count);
    } else if instruction_code == 2 {
        // Decrement counter
        let mut counter = get_or_init_counter(account)?;
        counter.decrement();
        counter.serialize(&mut *account.data.borrow_mut())?;
        msg!("Counter decremented to {}", counter.count);
    } else if instruction_code == 3 {
        // View counter
        let counter = get_or_init_counter(account)?;
        msg!("Current count: {}", counter.count);
    } else {
        msg!("Invalid instruction");
        return Err(ProgramError::InvalidInstructionData);
    }

    Ok(())
} 