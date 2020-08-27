module.exports = {
	coverageProvider: 'v8',
	displayName: 'unit test',
	preset: 'ts-jest',
	testEnvironment: 'node',
	testRunner: 'jest-circus/runner',
	testMatch: ['<rootDir>/test/**/*.test.ts'],
	globals: {
		'ts-jest': {
			tsConfig: '<rootDir>/test/tsconfig.json'
		}
	}
};
