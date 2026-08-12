export function formatDuration(
  milliseconds: number,
): string {
  const totalSeconds =
    Math.floor(
      milliseconds / 1000,
    );

  const hours =
    Math.floor(
      totalSeconds / 3600,
    );

  const minutes =
    Math.floor(
      (totalSeconds % 3600) / 60,
    );

  const seconds =
    totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

export function formatDurationClock(
  milliseconds: number,
): string {
  const totalSeconds =
    Math.floor(
      milliseconds / 1000,
    );

  const hours =
    Math.floor(
      totalSeconds / 3600,
    );

  const minutes =
    Math.floor(
      (totalSeconds % 3600) / 60,
    );

  const seconds =
    totalSeconds % 60;

  if (hours > 0) {
    return [
      String(hours),
      String(minutes).padStart(
        2,
        "0",
      ),
      String(seconds).padStart(
        2,
        "0",
      ),
    ].join(":");
  }

  return [
    String(minutes),
    String(seconds).padStart(
      2,
      "0",
    ),
  ].join(":");
}

export function formatPercentage(
  value: number,
  total: number,
): string {
  if (total <= 0) {
    return "0%";
  }

  const percentage =
    (value / total) * 100;

  if (percentage < 1) {
    return "<1%";
  }

  return `${Math.round(
    percentage,
  )}%`;
}

export function formatLanguageName(
  languageId: string,
): string {
  const knownLanguages:
    Record<string, string> = {
    javascript: "JavaScript",
    javascriptreact:
      "JavaScript React",

    typescript: "TypeScript",
    typescriptreact:
      "TypeScript React",

    json: "JSON",
    jsonc:
      "JSON with Comments",

    markdown: "Markdown",

    html: "HTML",

    css: "CSS",
    scss: "SCSS",
    less: "Less",

    python: "Python",

    go: "Go",

    rust: "Rust",

    shellscript:
      "Shell Script",

    powershell:
      "PowerShell",

    yaml: "YAML",

    dockerfile:
      "Dockerfile",

    sql: "SQL",

    php: "PHP",

    java: "Java",

    c: "C",
    cpp: "C++",
    csharp: "C#",
  };

  return (
    knownLanguages[languageId] ??
    languageId
  );
}