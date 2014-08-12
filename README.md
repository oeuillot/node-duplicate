# node-duplicate

A tool which removes duplicates resources.
It uses the size and compute the SHA256 on first 1Mo to identify the same resources.

## Help

```
 $ nodejs index.js --help

  Usage: server.js [options]

  Options:

    -d, --directory <path>  Specify a directory to scan
    -r, --remove            Remove duplicate file
    --maxHashSize           Size of hash

```

## Example

```  

 $ nodejs index.js -d /data/MyFilms -d /home/me/videos -d /home/Musiques

 ```
 
## Author

Olivier Oeuillot
