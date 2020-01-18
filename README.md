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

```
  -q, --quiet  Hides progress as it compares the directories. Defaults to false.
  -j, --json   Outputs results as JSON. Defaults to false.
```

## Examples

Given two folders `old/` and `new/`, whose contents are shown below:
```
old/
├── deleted.txt
├── unchanged.txt
└── updated.txt

new/
├── new.txt
├── sub/
│   └── file.txt
├── unchanged.txt
└── updated.txt
```

Comparing the two yeilds:

```
$ build-diff old new
Comparing "old" against "new"...
Diffing directories... Done
Parsing diff results... Done
Copying over changed files... Done
Zipping changed files... Done

The following files were deleted:
  deleted.txt


The following files were changed:
  new.txt
  sub
  updated.txt

All changed files have been copied to build_for_upload, and zipped in build_for_upload.zip
```

When using the `--quiet` and `--json` flag, I can pipe the output to [jq](https://github.com/stedolan/jq) and view the results as a formatted JSON string.

```
$ build-diff --quiet --json old new | jq
{
  "filesDeleted": [
    "deleted.txt"
  ],
  "filesChanged": [
    "new.txt",
    "sub",
    "updated.txt"
  ],
  "outputDir": "build_for_upload",
  "outputZip": "build_for_upload.zip"
}
```

## License

[MIT](./LICENSE)
