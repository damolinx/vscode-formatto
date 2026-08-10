export function commandToLogString(cmd: string, args: readonly string[], maxArgs = 10): string {
  if (args.length <= maxArgs) {
    return shellCommandToString(cmd, args);
  }

  return (
    shellCommandToString(cmd, args.slice(0, maxArgs)) + ` ... [${args.length - maxArgs} more args]`
  );
}

export function shellCommandToString(cmd: string, args: readonly string[]): string {
  return [shellQuote(cmd), ...args.map(shellQuote)].join(' ');
}

export function shellQuote(arg: string): string {
  return /^[A-Za-z0-9_./:-]+$/.test(arg) ? arg : `'${arg.replace(/'/g, "'\\''")}'`;
}
