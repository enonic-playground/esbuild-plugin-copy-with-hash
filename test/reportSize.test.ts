import { describe, expect, test } from '@jest/globals';
import { prettyBytes } from '../src/reportSize';


describe('reportSize', () => {
	describe('prettyBytes', () => {
		test('it handles 0 bytes', () => {
			expect(prettyBytes(0)).toBe('0 B');
		});
	});
});
