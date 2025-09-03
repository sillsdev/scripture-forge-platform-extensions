import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';

/** Recursively copy a directory and its contents */
function copyDirectory(src: string, dest: string): void {
  // Create destination directory if it doesn't exist
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }

  // Get all items in source directory
  const items = readdirSync(src);

  items.forEach((item) => {
    const srcPath = join(src, item);
    const destPath = join(dest, item);
    const stat = statSync(srcPath);

    if (stat.isDirectory()) {
      // Recursively copy subdirectory
      copyDirectory(srcPath, destPath);
    } else {
      // Copy file, creating parent directories if needed
      const destDir = dirname(destPath);
      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true });
      }
      copyFileSync(srcPath, destPath);
    }
  });
}

/** Copy a single file, creating parent directories if needed */
function copyFile(src: string, dest: string): void {
  const destDir = dirname(dest);
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }
  copyFileSync(src, dest);
}

// Main script execution
const main = () => {
  try {
    // Copy sf-pdp dist contents
    console.log('Copying sf-pdp dist contents...');
    const sfPdpDistDir = 'src/sf-pdp/dist';
    const sfPdpAssetsDir = 'src/scripture-forge/assets/sf-pdp';
    if (existsSync(sfPdpDistDir)) {
      copyDirectory(sfPdpDistDir, sfPdpAssetsDir);
    } else {
      console.error(`Error: ${sfPdpDistDir} does not exist`);
      process.exit(1);
    }

    // Copy messages dist contents
    console.log('Copying messages dist contents...');
    const messagesDistDir = 'src/messages/dist';
    const messagesNodeModulesDir = 'src/scripture-forge/assets/sf-pdp/node_modules/sf-pdp-messages';
    if (existsSync(messagesDistDir)) {
      copyDirectory(messagesDistDir, messagesNodeModulesDir);
    } else {
      console.error(`Error: ${messagesDistDir} does not exist`);
      process.exit(1);
    }

    // Copy messages package.json
    console.log('Copying messages package.json...');
    const messagesPackageJson = 'src/messages/package.json';
    const destPackageJson =
      'src/scripture-forge/assets/sf-pdp/node_modules/sf-pdp-messages/package.json';
    if (existsSync(messagesPackageJson)) {
      copyFile(messagesPackageJson, destPackageJson);
    } else {
      console.error(`Error: ${messagesPackageJson} does not exist`);
      process.exit(1);
    }

    console.log('✅ SF-PDP copy operation completed successfully!');
  } catch (error) {
    console.error('❌ Error during SF-PDP copy operation:', error);
    process.exit(1);
  }
};

// Run the script if called directly
if (require.main === module) {
  main();
}

export default main;
