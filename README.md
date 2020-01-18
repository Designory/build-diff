# Build Diff

[![npm version](https://badge.fury.io/js/%40designory%2Fbuild-diff.svg)](https://badge.fury.io/js/%40designory%2Fbuild-diff)

A small CLI utility to compare two "build" folders, and copy out the differences between them.

## Requirements

*  [`zip`](http://infozip.sourceforge.net/UnZip.html)
*  [`diff`](https://www.gnu.org/software/diffutils/)

Both of these come standard with macOS and probably most linux/unix flavors.

## Install

```
$ npm install -g @designory/build-diff
# or
$ yarn global add @designory/build-diff
```

## Usage

```
$ build-diff [options] <old-build-directory> <new-build-directory>
```

### Options

      -q, --quiet  Hides progress as it compares the directories. Defaults to false.
      -j, --json   Outputs results as JSON. Defaults to false.

## License

[MIT](./LICENSE)
