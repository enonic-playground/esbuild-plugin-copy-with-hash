module.exports = {
	preset: 'ts-jest/presets/js-with-babel-legacy',
	testEnvironment: 'node',
	transform: {
		'^.+\\.(js|jsx|ts|tsx)$': [
			'ts-jest',
			{
				tsConfig: 'test/tsconfig.json'
			}
		]
	},
};
