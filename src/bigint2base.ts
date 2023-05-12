export default function bigint2base(int: bigint|number, base: string) {

	let bigint = BigInt(int);
	let bib = BigInt( base.length );
	let result = '';

	while ( 0 < bigint ) {
		result = base.charAt( Number( bigint % bib ) ) + result;
		bigint = bigint / bib;
	}
	return result || '0';
}
