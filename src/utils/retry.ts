export async function retryWithBackoff<T>(
  fn: () => Promise<T>, 
  retries: number = 3
): Promise<T> {
  let attempt = 0;
  let delay = 1000; // 1 second

  while (attempt < retries) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      if (attempt >= retries) throw error;
      console.warn(`Retry attempt ${attempt} after failure:`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // exponential backoff
    }
  }

  throw new Error('Retry failed');
} 