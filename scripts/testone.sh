read -e -p "Enter the path to the file: " FILEPATH

mocha test/bootstrap.test.js $FILEPATH
echo "mocha test/bootstrap.test.js $FILEPATH"
