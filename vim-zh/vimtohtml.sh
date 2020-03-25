#!/bin/bash

for FILE in $(ls *.cnx); do
    if [ -f "$FILE" ]; then
        LANG=en_US.UTF-8 vim -u ./tohtml.vimrc -c TOhtml -c wqa $FILE
    else
        echo "$FILE not exists"
    fi
done

