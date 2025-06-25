/* eslint-disable no-console */
const esbuild = require('esbuild');

const isProduction = process.env.NODE_ENV === 'production';

const config = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/index.js',
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  minify: isProduction,
  treeShaking: true,
  sourcemap: true,
  // External packages that should not be bundled (if any)
  external: [],
  // Define environment variables
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
  // Additional options for production builds
  ...(isProduction && {
    drop: ['debugger'],
    keepNames: false,
  }),
};

// Build function
async function build() {
  try {
    await esbuild.build(config);
    console.log('✅ Build completed successfully');
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

// Run build if this file is executed directly
if (require.main === module) {
  build();
}

module.exports = { config, build };
