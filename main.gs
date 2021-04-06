/*
todo:
- Tweak decToRGB
  - Make the output correlate with input based on common logic
    - Currently, 0 is high and 1 is low (the opposite correlation, which isn't what we want as it may cause confusion)
  - Increase color range
    - Red Green Blue -> White Magenta Red Green Blue Purple Black
- Fix spreadsheet bug where non square grids erase a portion of their pressures with each tick
  - i suspect the issue maybe that the axis are being flipped between the transfer from array to spreadsheet
- Implement wall cells that can block pressure (mimick that of the border walls of the grid)
*/

// Timestamp for measuring entire runtime
const intStartStamp = Date.now()

// User Modifiable Variables
const intColumns          = 100         // Columns to set to new spreadsheets
const intRows             = 100         // Rows to set to new spreadsheets
const strSpreadSheetName  = "AtmosGrid" // Name to fetch or call new spreadsheets
const intTicks            = 10          // Ticks to simulate per run
const boolNewGrid         = true        // Boolean on whether to force create a new spreadsheet or not
const boolResize          = true        // Boolean on whether to resize the spreadsheet
const intResize           = 5           // Size in pixels of the output resizing

// Global Variables
var spreadGrid                          // Active Spreadsheet
var arraySim              = []          // Array of Active Spreadsheet to be simulated upon
var arraySimDiff          = []          // Array for storing changes in pressure during simulating

// Logging to output Variables currently set
Logger.log("User Set Variables:")
Logger.log("  Column and Row count:     "+intColumns+"x"+intRows)
Logger.log("  Spreadsheet Name string:  "+strSpreadSheetName)
Logger.log("  Ticks to simulate:        "+intTicks)
Logger.log("  Force create new sheet?:  "+boolNewGrid)
Logger.log("  Resize spreadsheet?:      "+boolResize)
Logger.log("    Pixels to resize to:      "+intResize)

function main() { // Initial function
  if (!fetchGrid(strSpreadSheetName) || boolNewGrid) {
    newGrid(intColumns,intRows,strSpreadSheetName)
    modGrid()
  }
  for (var intTick = 0;intTick < intTicks;intTick++) {
    simTick()
  }
  drawGrid(true)
  if (boolResize) {
    resize()
  }
  logData()
}

function modGrid() { // Function to manually add changes to the values on the spreadGrid outside of the simTick() Function
  // use the arraySim 2d array to add values
  arraySim[49][49] = 100000
}

function newGrid(intColumn, intRow, strGridName) { // Creates a new spreadsheet to simulate upon with the provided number of columns, rows, and name. Overwrites any spreadsheet with the same name
  // Removing Duplicate Files
  var filesResult = DriveApp.getFilesByName(strGridName)
  var intTrashed = 0
  while (filesResult.hasNext()) {
    var fileResult = filesResult.next()
    if (fileResult.getMimeType() == "application/vnd.google-apps.spreadsheet") { // Ensures the files to be deleted are spreadsheets
      fileResult.setTrashed(true)
      intTrashed++
      Logger.log("Duplicate Trashed ("+intTrashed+")")
    }
  }
  // Creating New Spreadsheet and Filling with default atmosphere
  spreadGrid = SpreadsheetApp.create(strGridName,intRow,intColumn)
  spreadGrid.setActiveRange(spreadGrid.getRange("1:"+intRow)).setValue(101.325) // 101.325 kpa = 1 atm
  arraySim = spreadGrid.getActiveRange().getValues();
}

function fetchGrid(strQuery) { // Fetches a spreadsheeet from the user's drive with the provided search query. returns true if successful
  var boolSuccess = false
  var filesResult = DriveApp.getFilesByName(strQuery)
  while (filesResult.hasNext()) {
    var fileResult = filesResult.next()
    if (fileResult.getMimeType() == "application/vnd.google-apps.spreadsheet") { // Checks if file is a spreadsheet
      spreadGrid = SpreadsheetApp.open(fileResult)
      arraySim = spreadGrid.getSheetValues(1,1,-1,-1)
      boolSuccess = true
      break
    }
  }
  return boolSuccess
}

function simTick() { // Simulates a single "tick" or cycle of atmospherics within the simulation array
  // Setting up pressure difference array
  for (var intArray = 0;intArray < arraySim.length;intArray++) {
    arraySimDiff[intArray] = arraySim[intArray].slice()
    arraySimDiff[intArray].fill(0)
  }

  // 2d For loop to simulate every cell within the grid
  for (var intRow = 0;intRow < intRows;intRow++) {
    for (var intColumn = 0;intColumn < intColumns;intColumn++) {
      var decCurrentPa = arraySim[intColumn][intRow]
      // Flags what surrounding cells not to check to avoid null cells
      var arrayPaDirection = [[true,true,true,true],[]]
      if (intRow == 0 || decCurrentPa <= arraySim[intColumn][intRow - 1]) {                 // North
        arrayPaDirection[0][0]  = false
      }
      if (intColumn == intColumns - 1 || decCurrentPa <= arraySim[intColumn + 1][intRow]) { // East
        arrayPaDirection[0][1]  = false
      }
      if (intRow == intRows - 1 || decCurrentPa <= arraySim[intColumn][intRow + 1]) {       // South
        arrayPaDirection[0][2]  = false
      }
      if (intColumn == 0 || decCurrentPa <= arraySim[intColumn - 1][intRow]) {              // West
        arrayPaDirection[0][3]  = false
      }

      // Grabs current and surrounding valid cells (as defined by the flags)
      if (arrayPaDirection[0][0]) { // North
        arrayPaDirection[1][0] = arraySim[intColumn][intRow - 1]
      }
      if (arrayPaDirection[0][1]) { // East
        arrayPaDirection[1][1] = arraySim[intColumn + 1][intRow]
      }
      if (arrayPaDirection[0][2]) { // South
        arrayPaDirection[1][2] = arraySim[intColumn][intRow + 1]
      }
      if (arrayPaDirection[0][3]) { // West
        arrayPaDirection[1][3] = arraySim[intColumn - 1][intRow]
      }

      // Calculates the mean of valid cells
      var decMean = decCurrentPa
      var intCells = 1
      for (var intIndex = 0;intIndex < arrayPaDirection[0].length;intIndex++) {
        if (arrayPaDirection[0][intIndex]) {
          decMean += arrayPaDirection[1][intIndex]
          intCells++
        }
      }
      decMean /= intCells

      // Calculates the pressure change upon and around current cell and applies it to the pressure difference array
      arraySimDiff[intColumn][intRow] += decMean - decCurrentPa
      if (arrayPaDirection[0][0]) { // North
        arraySimDiff[intColumn][intRow - 1] += decMean - arrayPaDirection[1][0]
      }
      if (arrayPaDirection[0][1]) { // East
        arraySimDiff[intColumn + 1][intRow] += decMean - arrayPaDirection[1][1]
      }
      if (arrayPaDirection[0][2]) { // South
        arraySimDiff[intColumn][intRow + 1] += decMean - arrayPaDirection[1][2]
      }
      if (arrayPaDirection[0][3]) { // West
        arraySimDiff[intColumn - 1][intRow] += decMean - arrayPaDirection[1][3]
      }
    }
  }

  // Applies pressure difference array to the simulated array
  for (var intRow = 0;intRow < intRows;intRow++) {
    for (var intColumn = 0;intColumn < intColumns;intColumn++) {
      arraySim[intRow][intColumn] += arraySimDiff[intRow][intColumn]
    }
  }
}

function drawGrid(boolColor) { // Updates the Spreadsheet with the current information on the array. If boolColor is true, color will be applied
  // Updates spreadsheet with the simulated array
  spreadGrid.setActiveRange(spreadGrid.getRange("1:"+intRows)).setValues(arraySim)

  if (boolColor) { // Checks whether boolColor is true and proceeds to calculate and color the spreadsheet
    var arrayColor = []
    // 101.325 kpa = 1 atm
    // 0 kpa is the minimum. No Max
    for (var intRow = 0; intRow < intRows;intRow++) {
      arrayColor.push(arraySim[intRow].slice())
    }
    for (var intRow = 0; intRow < intRows; intRow++) {
      for (var intColumn = 0; intColumn < intColumns; intColumn++) {
        var hexRGB = decToRGB(1 - arrayColor[intRow][intColumn]/202.65)
        arrayColor[intRow][intColumn] = Utilities.formatString("#%02f%02f%02f",hexRGB[0].toString(16),hexRGB[1].toString(16),hexRGB[2].toString(16))
      }
    }
    spreadGrid.setActiveRange(spreadGrid.getRange("1:"+intRows)).setBackgrounds(arrayColor)

    function decToRGB(num) { // Converts a range of Decimal to a range of RGB in an array (0 is high, 1 is low)
      var intR = 0
      var intG = 0
      var intB = 0
      if (num >= 0 && num <= 0.5) {           // Red and Green Mixes (0 <= num <= 0.5)
        if (num >= 0 && num <= 0.25) {          // Orange (0 <= num <= 0.25)
          intR = 255
          intG = 255*(num/0.25)
        } else if (num > 0.25 && num <= 0.5) {  // Lime (0.25 < num <= 0.5)
          intR = 255-255*((num-0.25)/0.25)
          intG = 255
        }
      } else if (num > 0.5 && num <= 1) {     // Green and Blue mixes (0.5 < num <= 1)
        if (num >= 0.5 && num <= 0.75) {        // Sea Green (0.5 <= num <= 0.75)
          intG = 255
          intB = 255*(num/0.75)
        } else if (num > 0.75 && num <= 1) {    // Cyan (0.75 < num <= 1)
          intG = 255-255*((num-0.25)/0.75)
          intB = 255
        }
      } else if (num > 1) {                   // Blue (1 < num)
        intB = 255
      } else {                                // Red Fall Back
        intR = 255
      }
      return [Math.round(intR), Math.round(intG), Math.round(intB)]
    }
  }
}

function resize() {
  for (var intColumn = 1;intColumn <= intColumns;intColumn++) {
    spreadGrid.setColumnWidth(intColumn,intResize)
  }
  for (var intRow = 1;intRow <= intRows;intRow++) {
    spreadGrid.setRowHeight(intRow,intResize)
  }
}

function logData() { // Calculates and outputs run data to log
  var intTotalMS = Date.now() - intStartStamp
  Logger.log(Utilities.formatString("Total execution time: %.1fs (%.0fms)",intTotalMS/1000,intTotalMS))
}
