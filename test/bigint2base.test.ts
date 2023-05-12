import {describe, expect, test} from '@jest/globals';
import bigint2base from '../src/bigint2base';

const BASE_36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

describe('bigint2base', () => {
	test('it returns a valid esbuild plugin interface', () => {
		expect(bigint2base(0, BASE_36)).toBe('0');
		expect(bigint2base(35, BASE_36)).toBe('Z');
		expect(bigint2base(36, BASE_36)).toBe('10');
		expect(bigint2base(37, BASE_36)).toBe('11');
		expect(bigint2base(Number.MAX_SAFE_INTEGER, BASE_36)).toBe('2GOSA7PA2GV');
		expect(bigint2base(Number.MAX_SAFE_INTEGER+1, BASE_36)).toBe('2GOSA7PA2GW');
		expect(bigint2base(Number.MAX_SAFE_INTEGER + Number.MAX_SAFE_INTEGER, BASE_36)).toBe('4XDKKFEK4XQ');
	});
});
