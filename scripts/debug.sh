echo "stopping forever"
forever stopall
echo "killall -9 grunt"
killall -9 grunt
killall -9 node

node-inspector --save-live-edit=true & nodemon --debug app.js
