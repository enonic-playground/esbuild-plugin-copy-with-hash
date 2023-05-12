import { describe, expect, test } from '@jest/globals';
import { colorize } from '../src/log';
import {
	blue, red, yellow, green
} from 'colorette';


describe('log', () => {
	describe('colorize', () => {
		test('it uses the correct colors', () => {
			expect(colorize('info', 'info')).toBe(blue('info'));
			expect(colorize('error', 'error')).toBe(red('error'));
			expect(colorize('warn', 'warn')).toBe(yellow('warn'));
			expect(colorize('success', 'success')).toBe(green('success'));
		});
	});
});
