// Mock better-sqlite3
jest.mock("better-sqlite3", () => {
  return jest.fn().mockImplementation(() => ({
    prepare: jest.fn().mockReturnValue({
      run: jest.fn(),
      get: jest.fn(),
      all: jest.fn(),
      finalize: jest.fn(),
    }),
    exec: jest.fn(),
    close: jest.fn(),
    transaction: jest.fn(),
  }));
});
