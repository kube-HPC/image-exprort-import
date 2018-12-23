const { spawn } = require('child_process');
const { callDone, done, semaphore } = require('await-done');
let counterAmount = 5
const delay = require('await-delay');
const colors = require('colors');
const _spawn = async (command, args, options, { stdout, stderr } = {}) => {
    let sema = new semaphore();
    let argsArr = args.replace(/^\s+/, '').replace(/\s+$/, '').split(' ');
    const start = spawn(command, argsArr, options);
    //console.log(start.output);
    if (stdout) {
        start.stdout.pipe(stdout);
    }
    start.stdout.on('data', (data) => {
        console.log(data.toString());
    });
    if (stderr) {
        start.stderr.pipe(stderr);
    }
    start.stderr.on('data', (data) => {
        console.log(data.toString());
    });
    start.on('exit', (code) => {
        console.log(`( ${command} ${args} ) spawn closed with code ${code}`.yellow);
        sema.callDone()
    });
    await sema.done();
}


const syncSpawn = async (command, args, options, pipeOptions = {}) => {
    let counter = 0;
    try {
        console.log(`trying to spwan ${command} ${args} `.blue)
        await _spawn(command, args, options, pipeOptions);

    } catch (error) {
        console.error(`spwan ${command} ${args} `.blue)
        counter = counter + 1;
        if (counter < counterAmount) {
            await delay(5000);
            await _spawn(command, args, options, pipeOptions);
        }
    }

}

module.exports = syncSpawn;