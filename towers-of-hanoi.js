// Copyright (c) by Anders Kristensen 2011, all rights reserved.
// Made available under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0.html

// To do:
// 1. Add "solve" feature
//    a) applicable only for initial setup
//    b) at any time (preferably with optimal solution given current config)
// 2. Animated transitions (especially for "solve" mode and for dragging)
// 3. Drag-and-drop feedback, e.g. change color of target peg.
// 4. Use SVG instead of Canvas.
// 5. Make work with phone/tablet gestures.

var numDisks = 3;
var diskWidthInitial = 40;
var diskWidthIncr = 20;
var diskWidthMax;
var diskHeight = 12;
var diskHorizSpace = 20;
var diskVerticalSpace = 4;
var pegWidth = 10;
var canvasMargins = {
    top: 20,
    bottom: 20,
    left: 20,
    right: 20
};
var pegPadding = {
    top: 10,
    bottom: 6,
    interDisk: 4
};
var canvasElement;
var audioElement;
var statusElement;
var movesElement;
var numMoves;
var timeElement;
var startTimeMillis;
var intervalId;
var context;

var swooshSound = "audio/swoosh3.mp3";
var applauseSound = "audio/applause2.mp3";
var playAudio = false;

var pegHeight;
var pegs;  // array of Pegs
var selectedPeg;
var selectedDisk;
var selectedOnMouseDown

/* Returns last element in list without removing it. */
Array.prototype.peek = function() {
    return this.length == 0 ? null : this[this.length-1];
}

function Peg(id) {
    this.id = id;
    var maxDiskWidth = diskWidthInitial + diskWidthIncr*(numDisks-1);
    this.x = canvasMargins.left + maxDiskWidth/2 + (this.id-1)*(maxDiskWidth + diskHorizSpace);
    this.x0 = this.x - pegWidth/2;
    this.y0 = canvasMargins.top;
    this.boundingBox = {
        x0: this.x - diskWidthMax/2,
        y0: this.y0,
        x1: this.x + diskWidthMax/2,
        y1: this.y0 + pegHeight
    };
    this.disks = [];
}

Peg.prototype.toString = function() {
    return "Peg[" + this.id + "]";
}

Peg.prototype.insideBoundingBox = function(x, y) {
    return this.boundingBox.x0 <= x && x <= this.boundingBox.x1
        && this.boundingBox.y0 <= y && y <= this.boundingBox.y1;
}

Peg.prototype.push = function(disk) {
    if (this.disks.length > 0 && disk.id > this.disks[this.disks.length-1].id) {
        throw "cannot push bigger disk onto smaller disk";
    }
    this.disks.push(disk);
}

Peg.prototype.draw = function() {
    context.beginPath();
    context.lineWidth = pegWidth;
    context.lineCap = "butt";
    context.shadowOffsetX = 5;
    context.shadowOffsetY = 5;
    context.shadowBlur = 4;
    context.shadowColor = 'rgba(128, 128, 128, 0.5)';
    context.strokeStyle = "#000";
    context.moveTo(this.x, this.y0);
    context.lineTo(this.x, this.y0 + pegHeight);
    context.stroke();
    for (var i = 0; i < this.disks.length; i++) {
        this.disks[i].draw(this, i);
    }
}

function Disk(id) {
    this.id = id; // integer id from 1 (smallest disk) and up
    this.width = diskWidthInitial + diskWidthIncr*(id-1);
    this.selected = false;
}

Disk.prototype.toString = function() {
    return "Disk[" + this.id + "]";
}

Disk.prototype.setSelected = function(b) {
    this.selected = b;
    selectedDisk = (b ? this : null);
}

/*
 * Draw the disk on the specified Peg at the specified position. Pos 0
 * is the bottom-most disk.
 */
Disk.prototype.draw = function(peg, posFromBottom) {
    context.beginPath();
    context.lineWidth = diskHeight;
    context.lineCap = "round";
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 0;
    context.strokeStyle = (this.selected ? "#79e" : "#458");
    var lineLength = this.width - diskHeight;
    var x0 = peg.x - lineLength/2;
    var x1 = x0 + lineLength;
    var y = peg.y0 + pegHeight - pegPadding.bottom - posFromBottom*(diskHeight + diskVerticalSpace) - diskHeight/2;
    context.moveTo(x0, y);
    context.lineTo(x1, y);
    context.stroke();
}

function draw() {
    context.clearRect(0, 0, canvasElement.width, canvasElement.height);
    for (var i = 0; i < pegs.length; i++) {
        pegs[i].draw();
    }
    movesElement.innerHTML = numMoves;
}

/* Listener fct for HTML dropdown box. */
function numDisksChanged(e) {
    var numDisksElement = document.getElementById("num-disks");
    numDisks = numDisksElement.value;
    console.log("numDisksChanged: " + numDisks);
    initTowers();
}

function getClickedPeg(e) {
    var x;
    var y;
    if (e.pageX != undefined && e.pageY != undefined) {
        x = e.pageX;
        y = e.pageY;
    }
    else {
        x = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
        y = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
    }
    x -= canvasElement.offsetLeft;
    y -= canvasElement.offsetTop;
    
    for (var i = 0; i < pegs.length; i++) {
        var p = pegs[i];
        if (pegs[i].insideBoundingBox(x, y)) {
            return pegs[i];
        }
    }
    return null;
}

function moveLegal(pegFrom, pegTo) {
    var disk = pegFrom.disks.peek();
    var topDiskPegTo = pegTo.disks.peek();
    return (pegFrom !== pegTo) && disk && (!topDiskPegTo || disk.id < topDiskPegTo.id);
}

function isDone() {
    return pegs.peek().disks.length == numDisks;
}

function onMouseEvent(e) {
    var peg = getClickedPeg(e);
    console.log("onMouseEvent: " + e.type + " " + (peg ? "peg " + peg.id : "nowhere"));
    if (isDone() || !peg) return;
    if (!intervalId) {
        startTimeMillis = new Date().getTime();
        intervalId = setInterval(updateTime, 1000);
    }
    var disk = peg.disks.peek();

    console.log("onMouseEvent: " + selectedDisk + " " + selectedOnMouseDown + " " + peg + " " + selectedDisk);
    
    if (selectedDisk) {
        if (e.type == "click") {
            if (moveLegal(selectedPeg, peg)) {
                play(swooshSound);
                selectedPeg.disks.pop();
                peg.push(selectedDisk);
                numMoves++;
                selectedDisk.setSelected(false);
            } else if (selectedDisk === disk && !selectedOnMouseDown) {
                selectedDisk.setSelected(false);
            }
            selectedOnMouseDown = false;
            if (isDone()) {
                stopTimer();
                statusElement.innerHTML = "Done!<br>";
                play(applauseSound);
            }
        }
    } else if (disk) {
        selectedPeg = peg;
        disk.setSelected(true);
        selectedOnMouseDown = (e.type == "mousedown");
    }
    draw();
}

function stopTimer() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = undefined;
    }
}
function updateTime() {
    var ms = new Date().getTime() - startTimeMillis;
    var seconds = Math.floor(ms/1000);
    var minutes = Math.floor(seconds/60);
    seconds = seconds % 60;
    timeElement.innerHTML = dd(minutes) + ":" + dd(seconds);
}

function dd(i) {
    return i <= 9 ? "0" + i : "" + i;
}

function play(src) {
    console.log("play: " + src);
    playAudio = true;
    audioElement.src = src;
    //audioElement.currentTime = 0;
    //audioElement.play();
}

function initTowers() {
    console.log("initTowers");
    canvasElement = document.getElementById("towers-canvas");
    if (!canvasElement) {
        canvasElement = document.createElement("canvas");
        canvasElement.id = "towers-canvas";
        document.body.appendChild(canvasElement);
    }
    context = canvasElement.getContext("2d");
    audioElement = document.getElementById("towers-audio");
    //audioElement.playbackRate = 1.5;
    audioElement.pause();
    audioElement.addEventListener("canplaythrough", function() {
        console.log("canplaythrough callback");
        if (playAudio) {
            playAudio = false;
            audioElement.currentTime = 0;
            audioElement.play();
        }
    }, false);
    statusElement = document.getElementById("status");
    statusElement.innerHTML = "";
    movesElement = document.getElementById("moves");
    numMoves = 0;
    timeElement = document.getElementById("time");
    startTimeMillis = 0;
    stopTimer();
    timeElement.innerHTML = "00:00";
    
    diskWidthMax = diskWidthInitial + (numDisks-1)*diskWidthIncr;
    pegHeight = pegPadding.top + numDisks*diskHeight + (numDisks-1)*diskVerticalSpace + pegPadding.bottom;
    pegs = [ new Peg(1), new Peg(2), new Peg(3) ];
    canvasElement.height = pegHeight + canvasMargins.top + canvasMargins.bottom;
    canvasElement.width = pegs.peek().boundingBox.x1 + canvasMargins.right;
    canvasElement.addEventListener("mousedown", onMouseEvent, false);
    canvasElement.addEventListener("click", onMouseEvent, false);
    var numDisksElement = document.getElementById("num-disks");
    numDisksElement.addEventListener("change", numDisksChanged, false);
    document.getElementById("reset").addEventListener("click", initTowers, false);
    
    for (var i = numDisks; i > 0; i--) {
        pegs[0].push(new Disk(i));
    }
    
    draw();
}

window.onload = initTowers;
