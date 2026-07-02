import { supabase } from '../lib/supabase';

class SupabaseService {
  private async checkConnection(): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('departments')
        .select('count', { count: 'exact', head: true });
      
      return !error;
    } catch {
      return false;
    }
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 2
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          
          // Check connection before retry
          const isConnected = await this.checkConnection();
          if (!isConnected) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
    }
    
    throw lastError;
  }

  // Generic query method with retry logic
  async query<T>(
    operation: () => Promise<{ data: T | null; error: any }>
  ): Promise<{ data: T | null; error: any }> {
    return this.retryOperation(operation);
  }

  // Generic insert method with retry logic
  async insert<T>(
    table: string,
    data: any
  ): Promise<{ data: T | null; error: any }> {
    return this.retryOperation(async () => {
      return await supabase
        .from(table)
        .insert(data)
        .select();
    });
  }

  // Generic update method with retry logic
  async update<T>(
    table: string,
    data: any,
    match: Record<string, any>
  ): Promise<{ data: T | null; error: any }> {
    return this.retryOperation(async () => {
      let query = supabase.from(table).update(data);
      
      // Apply match conditions
      Object.entries(match).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
      
      return await query.select();
    });
  }

  // Generic delete method with retry logic
  async delete<T>(
    table: string,
    match: Record<string, any>
  ): Promise<{ data: T | null; error: any }> {
    return this.retryOperation(async () => {
      let query = supabase.from(table).delete();
      
      // Apply match conditions
      Object.entries(match).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
      
      return await query.select();
    });
  }

  // Generic select method with retry logic
  async select<T>(
    table: string,
    columns: string = '*',
    filters?: Record<string, any>
  ): Promise<{ data: T | null; error: any }> {
    return this.retryOperation(async () => {
      let query = supabase.from(table).select(columns);
      
      // Apply filters
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }
      
      return await query;
    });
  }
}

export const supabaseService = new SupabaseService();
export default supabaseService;
