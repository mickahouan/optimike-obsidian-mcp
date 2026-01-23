#!/usr/bin/env node

/**
 * @fileoverview Utility script to make files executable (chmod +x) on Unix-like systems.
 * @module scripts/make-executable
 *   On Windows, this script does nothing but exits successfully.
 *   Useful for CLI applications where built output needs executable permissions.
 *   Default target (if no args): dist/index.js.
 *   Ensures output paths are within the project directory for security.
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const isUnix = os.platform() !== "win32";
const projectRoot = process.cwd();
const EXECUTABLE_MODE = 0o755; // rwxr-xr-x

const makeExecutable = async () => {
  try {
    const targetFiles =
      process.argv.slice(2).length > 0 ? process.argv.slice(2) : ["dist/index.js"];

    if (!isUnix) {
      console.log(
        "Skipping chmod operation: Script is running on Windows (not applicable).",
      );
      return;
    }

    console.log(`Attempting to make files executable: ${targetFiles.join(", ")}`);

    const results = await Promise.allSettled(
      targetFiles.map(async (targetFile) => {
        const normalizedPath = path.resolve(projectRoot, targetFile);

        if (
          !normalizedPath.startsWith(projectRoot + path.sep) &&
          normalizedPath !== projectRoot
        ) {
          return {
            file: targetFile,
            status: "error",
            reason: `Path resolves outside project boundary: ${normalizedPath}`,
          };
        }

        try {
          await fs.access(normalizedPath); // Check if file exists
          await fs.chmod(normalizedPath, EXECUTABLE_MODE);
          return { file: targetFile, status: "success" };
        } catch (error) {
          const err = error;
          if (err && err.code === "ENOENT") {
            return {
              file: targetFile,
              status: "error",
              reason: "File not found",
            };
          }
          console.error(
            `Error setting executable permission for ${targetFile}: ${err?.message ?? err}`,
          );
          return {
            file: targetFile,
            status: "error",
            reason: err?.message ?? String(err),
          };
        }
      }),
    );

    let hasErrors = false;
    results.forEach((result) => {
      if (result.status === "fulfilled") {
        const { file, status, reason } = result.value;
        if (status === "success") {
          console.log(`Successfully made executable: ${file}`);
        } else if (status === "error") {
          console.error(`Error for ${file}: ${reason}`);
          hasErrors = true;
        } else if (status === "skipped") {
          console.warn(`Skipped ${file}: ${reason}`);
        }
      } else {
        console.error(`Unexpected failure for one of the files: ${result.reason}`);
        hasErrors = true;
      }
    });

    if (hasErrors) {
      console.error(
        "One or more files could not be made executable. Please check the errors above.",
      );
    } else {
      console.log("All targeted files processed successfully.");
    }
  } catch (error) {
    console.error(
      "A fatal error occurred during the make-executable script:",
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }
};

makeExecutable();
