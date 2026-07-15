export function argumentValue(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value && !value.startsWith("--") ? value : null;
}

export function requiredArgument(name: string): string {
  const value = argumentValue(name);
  if (!value) throw new Error(`Missing required --${name} argument.`);
  return value;
}

export function repeatedArgumentValues(name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] !== `--${name}`) continue;
    const value = process.argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value after --${name}.`);
    }
    values.push(value);
    index += 1;
  }
  return values;
}
