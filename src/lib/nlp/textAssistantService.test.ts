import { describe, expect, it } from 'bun:test';
import {
  parseIndonesianAmount,
  parseRelativeDate,
  parseTransactionLocally,
  type TextCategoryContext,
  type TextAccountContext,
} from './textAssistantService';

describe('textAssistantService Unit Tests', () => {
  describe('parseIndonesianAmount', () => {
    it('parses Indonesian amounts with "rb"', () => {
      expect(parseIndonesianAmount('makan siang 35rb')).toBe(35000);
      expect(parseIndonesianAmount('beli pulsa 100 rb')).toBe(100000);
      expect(parseIndonesianAmount('roti 12.5rb')).toBe(12500);
    });

    it('parses Indonesian amounts with "k"', () => {
      expect(parseIndonesianAmount('kopi susu 25k')).toBe(25000);
      expect(parseIndonesianAmount('50k bensin')).toBe(50000);
      expect(parseIndonesianAmount('croissant 22.5k')).toBe(22500);
    });

    it('parses Indonesian amounts with "jt"', () => {
      expect(parseIndonesianAmount('gaji 8.5jt')).toBe(8500000);
      expect(parseIndonesianAmount('bonus 5 jt')).toBe(5000000);
      expect(parseIndonesianAmount('laptop 12jt')).toBe(12000000);
    });

    it('parses dot-formatted Rupiah integer strings', () => {
      expect(parseIndonesianAmount('belanja 150.000')).toBe(150000);
      expect(parseIndonesianAmount('transfer 1.250.000')).toBe(1250000);
      expect(parseIndonesianAmount('bayar 50000')).toBe(50000);
    });

    it('returns null if no valid monetary amount found', () => {
      expect(parseIndonesianAmount('halo halo selamat sore')).toBeNull();
    });
  });

  describe('parseRelativeDate', () => {
    it('handles "hari ini", "kemarin", "lusa"', () => {
      const today = new Date().toISOString().slice(0, 10);
      expect(parseRelativeDate('makan padang tadi siang')).toBe(today);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);
      expect(parseRelativeDate('beli bensin kemarin 50rb')).toBe(yesterdayStr);
    });
  });

  describe('parseTransactionLocally (Offline Fallback)', () => {
    const mockCategories: TextCategoryContext[] = [
      { id: 'cat-food', name: 'Makanan & Minuman', type: 'expense' },
      { id: 'cat-transport', name: 'Transportasi', type: 'expense' },
      { id: 'cat-salary', name: 'Gaji', type: 'income' },
      { id: 'cat-bills', name: 'Tagihan & Utilitas', type: 'expense' },
    ];

    const mockAccounts: TextAccountContext[] = [
      { id: 'acc-bca', name: 'BCA Utama', kind: 'asset' },
      { id: 'acc-jago', name: 'Bank Jago', kind: 'asset' },
      { id: 'acc-gopay', name: 'GoPay', kind: 'asset' },
      { id: 'acc-spaylater', name: 'SPayLater', kind: 'liability' },
    ];

    it('parses an expense with account and category hints', () => {
      const result = parseTransactionLocally(
        'Makan siang padang 35rb pake gopay',
        mockCategories,
        mockAccounts
      );
      expect(result.amount).toBe(35000);
      expect(result.type).toBe('expense');
      expect(result.accountId).toBe('acc-gopay');
      expect(result.categoryId).toBe('cat-food');
      expect(result.description).toContain('Makan');
    });

    it('parses income correctly', () => {
      const result = parseTransactionLocally(
        'Gaji bulanan masuk 8.5jt ke BCA',
        mockCategories,
        mockAccounts
      );
      expect(result.amount).toBe(8500000);
      expect(result.type).toBe('income');
      expect(result.accountId).toBe('acc-bca');
      expect(result.categoryId).toBe('cat-salary');
    });

    it('parses transfer between accounts', () => {
      const result = parseTransactionLocally(
        'Transfer 200rb dari BCA ke Jago',
        mockCategories,
        mockAccounts
      );
      expect(result.amount).toBe(200000);
      expect(result.type).toBe('transfer');
      expect(result.accountId).toBe('acc-bca');
      expect(result.toAccountId).toBe('acc-jago');
    });

    it('identifies paylater/liability accounts', () => {
      const result = parseTransactionLocally(
        'Beli kemeja 150.000 pake spaylater',
        mockCategories,
        mockAccounts
      );
      expect(result.amount).toBe(150000);
      expect(result.type).toBe('expense');
      expect(result.accountId).toBe('acc-spaylater');
    });
  });
});
