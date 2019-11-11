const fs = require('fs')
var request = require('request')
const phantom = require('phantom');
var isRunning = false
var currTime = 0
var lastTime = 0

var mainfile = "/var/www/html/rates/index.html"
var supply = "/var/www/html/rates/supply"
var marketcap = "/var/www/html/rates/marketcap"
var currPrice = "/var/www/html/rates/price"
var currPriceNoRound = "/var/www/html/rates/pricenoround"
var priceChangeLoc = "/var/www/html/rates/pricechange"


// var mainfile = "index.html"
// var supply = "supply"
// var marketcap = "marketcap"
// var currPrice = "price"
// var currPriceNoRound = "pricenoround"
// var priceChangeLoc = "pricechange"

var usdUrl = "http://www.floatrates.com/daily/usd.json"
var xsgUrl = "https://coinmarketcap.com/currencies/snowgem/"
var btcUrl = "https://coinmarketcap.com/currencies/bitcoin/"
var ethUrl = "https://coinmarketcap.com/currencies/ethereum/"
var bchUrl = "https://coinmarketcap.com/currencies/bitcoin-cash/"
var zecUrl = "https://coinmarketcap.com/currencies/zcash/"
var dashUrl = "https://coinmarketcap.com/currencies/dash/"
var zenUrl = "https://coinmarketcap.com/currencies/zencash/"

var coinist = [
  {
    name: 'Bitcoin',
    symbol: 'btc',
    url: btcUrl
  },
  {
    name: 'Ethereum',
    symbol: 'eth',
    url: ethUrl
  },
  {
    name: 'SnowGem',
    symbol: 'xsg',
    url: xsgUrl
  },
  {
    name: 'Bitcoin Cash',
    symbol: 'bch',
    url: bchUrl
  },
  {
    name: 'Zcash',
    symbol: 'zec',
    url: zecUrl
  },
  {
    name: 'Dash',
    symbol: 'dash',
    url: dashUrl
  },
  {
    name: 'Horizen',
    symbol: 'zen',
    url: zenUrl
  },
]

function curlData(urlRequest, params){
  return new Promise(function(resolve){
    request.post(urlRequest, {
      json: params
    }, function(error, res, body){
      var result = {}
      if (error) {
        result.error = true
        result.result = error
      } else {
        result.error = false
        result.result = body
      }
      resolve(result)
    })
  })
}

function getUSD(cb){
  var promisesToMake = [curlData(usdUrl)]
  var result = Promise.all(promisesToMake);
  result.then(function(result){
    cb(result[0])
  }, function(err) {
    cb(null)
  })
}

function formatNumber(num) {
  return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')
}

function getWebsiteContentOld(coin, name, url, id, classname){
  return new Promise(async function(resolve){
    var driver = await phantom.create();
    var rtnData = {}
    try
    {
      var page = await driver.createPage();
      page.on('onConsoleMessage', function (msg) {
        // console.log('phantomjs page console message', msg);
      });
      page.on('onError', function (msg)  {
        // console.log('phantomjs page console message', msg);
      });

      page.property("viewportSize", {width: 1920, height: 1080}).then(function(){

      })

      page.on('onResourceRequested', function(requestData) {
        // console.info('Requesting', requestData.url);
      })

      // page.property('onCallback', (data) => {
      //   console.log(data)
      //   if (data.type === "loadFinished") {
      //       // do some testing
      //   }
      // })
      await page.open(url)
      var data = id ? 
        await page.evaluate(function(s) {
          return document.getElementsById(s)[0].innerText
        }, id ? id : classname)
        :
        await page.evaluate(function(s) {
          return document.getElementsByClassName(s)[0].innerText;
        }, id ? id : classname)

      data = standardData(data)
      rtnData.coin = coin
      rtnData.data = parseData(data.split(/\n/))
      rtnData.name = name
      // console.log(rtnData)
      await driver.exit()
      resolve(rtnData)

      function standardData(data){
        data = data.replace(/ \t|\t |\t/g, '|')
        data = data.replace(/ \n/g, ' ')
        return data
      }
    }
    catch(ex)
    {
      fs.appendFileSync('reject.log', ex.toString() + '\n')
      await driver.exit()
      resolve(rtnData)
    }
  })
}

function parseData(data){
  var rtn = {}
  try
  {
    var index = data.findIndex(function(e){return e.toLowerCase().includes('price')})
    rtn.price = parseFloat(data[index].split('|')[1])
    index = data.findIndex(function(e){return e.toLowerCase().includes('market cap')})
    rtn.marketcap = parseFloat(data[index].split('|')[1])
    index = data.findIndex(function(e){return e.toLowerCase().includes('24 hour volume')})
    rtn.volume24h = parseFloat(data[index].split('|')[1])
    index = data.findIndex(function(e){return e.toLowerCase().includes('circulating supply')})
    rtn.circulating = parseFloat(data[index].split('|')[1])
    index = data.findIndex(function(e){return e.toLowerCase().includes("coin change")})
    rtn.change = parseFloat(data[index].split('|')[1])
  }
  catch(ex){}
  return rtn
}


function createData(){
  var coinlistClone = JSON.parse(JSON.stringify(coinist))
  lastTime = Math.floor(Date.now() / 1000)
  console.log("getting data")

  getUSD(function cb(data){
    try
    {
      data = JSON.parse(data.result)
      var usd = 1
      var usdeur = 1 / data.eur.rate
      var usdrub = 1 / data.rub.rate
      var usdgbp = 1 / data.gbp.rate

      var finalResult = []
      if(fs.existsSync(mainfile))
        finalResult = JSON.parse(fs.readFileSync(mainfile))

      var index = finalResult.findIndex(function(e){return e.code == 'USD'})
      if(index > -1)
      {
        finalResult.splice(index, 1)
      }
      var usdJson = {}
      usdJson.code = "USD"
      usdJson.symbol = "$"
      usdJson.name = "US Dollar"
      usdJson.rate = parseFloat(usd.toFixed(3))
      usdJson.price = parseFloat(usd.toFixed(3))
      finalResult.push(usdJson)

      index = finalResult.findIndex(function(e){return e.code == 'EUR'})
      if(index > -1)
      {
        finalResult.splice(index, 1)
      }
      var eurJson = {}
      eurJson.code = "EUR"
      eurJson.symbol = "€"
      eurJson.name = "Euro"
      eurJson.rate = parseFloat(data.eur.rate.toFixed(3))
      eurJson.price = parseFloat(usdeur.toFixed(3))
      finalResult.push(eurJson)

      index = finalResult.findIndex(function(e){return e.code == 'RUB'})
      if(index > -1)
      {
        finalResult.splice(index, 1)
      }
      var rubJson = {}
      rubJson.code = "RUB"
      rubJson.symbol = "₽"
      rubJson.name = "Russian Rouble"
      rubJson.rate = parseFloat(data.rub.rate.toFixed(3))
      rubJson.price = parseFloat(usdrub.toFixed(3))
      finalResult.push(rubJson)

      index = finalResult.findIndex(function(e){return e.code == 'GBP'})
      if(index > -1)
      {
        finalResult.splice(index, 1)
      }
      var gbpJson = {}
      gbpJson.code = "GBP"
      gbpJson.symbol = "£"
      gbpJson.name = "U.K. Pound Sterling"
      gbpJson.rate = parseFloat(data.gbp.rate.toFixed(3))
      gbpJson.price = parseFloat((usdgbp).toFixed(3))
      finalResult.push(gbpJson)


      fs.writeFileSync(mainfile, JSON.stringify(finalResult))

      function getData(element){
        var promisesToMake = [
          getWebsiteContent(element.symbol, element.name, element.url)
        ]
        var result = Promise.all(promisesToMake);
        result
        .then(function(result){
          if(result && result.length > 0 && result[0].coin)
          {
            index = finalResult.findIndex(function(e){return e.code == result[0].coin.toUpperCase()})
            if(index > -1)
            {
              finalResult.splice(index, 1)
            }
            if(result[0].coin == 'btc'){
              console.log(result[0])
              var btcJson = {}
              btcJson.code = "BTC"
              btcJson.symbol = "฿"
              btcJson.name = "Bitcoin"
              btcJson.rate = 1
              btcJson.price = result[0].data.price
              btcJson.pricechange = result[0].data.change
              btcJson.marketcap = result[0].data.marketcap
              btcJson.volume24h = result[0].data.volume24h
              btcJson.circulating = result[0].data.circulating
              finalResult.push(btcJson)
              fs.writeFileSync(mainfile, JSON.stringify(finalResult))

              if(coinlistClone.length > 0){
                var element = coinlistClone[0]
                coinlistClone.splice(0,1)
                setTimeout(function(){
                  getData(element)
                }, 10000);
              }
              else
              {
                setTimeout(function(){
                  createData()
                }, 20000);
              }
            }
            else if(result[0].coin == 'eth'){
              console.log(result[0])
              var ethJson = {}
              ethJson.code = "ETH"
              ethJson.symbol = "E"
              ethJson.name = "Ethereum"
              ethJson.rate = 1
              ethJson.price = result[0].data.price
              ethJson.pricechange = result[0].data.change
              ethJson.marketcap = result[0].data.marketcap
              ethJson.volume24h = result[0].data.volume24h
              ethJson.circulating = result[0].data.circulating
              finalResult.push(ethJson)
              fs.writeFileSync(mainfile, JSON.stringify(finalResult))

              if(coinlistClone.length > 0){
                var element = coinlistClone[0]
                coinlistClone.splice(0,1)
                setTimeout(function(){
                  getData(element)
                }, 10000);
              }
              else
              {
                setTimeout(function(){
                  createData()
                }, 20000);
              }
            }
            else
            {
              indexBTC = finalResult.findIndex(function(e){return e.code == 'BTC'})
              indexETH = finalResult.findIndex(function(e){return e.code == 'ETH'})
              console.log(result[0])
              var coinJson = {}
              coinJson.code = result[0].coin.toUpperCase()
              coinJson.name = result[0].name
              coinJson.rate = parseFloat((finalResult[indexBTC].price / result[0].data.price).toFixed(2))
              coinJson.rateETH = parseFloat((finalResult[indexETH].price / result[0].data.price).toFixed(2))
              coinJson.price = parseFloat((result[0].data.price).toFixed(3))
              coinJson.pricechange = result[0].data.change
              coinJson.marketcap = result[0].data.marketcap
              coinJson.volume24h = result[0].data.volume24h
              coinJson.circulating = result[0].data.circulating
              finalResult.push(coinJson)
              fs.writeFileSync(mainfile, JSON.stringify(finalResult))

              if(result[0].coin == 'xsg')
              {
                fs.writeFileSync(currPrice, formatNumber(parseFloat(coinJson.price.toFixed(3))))
                fs.writeFileSync(currPriceNoRound, formatNumber(parseFloat(coinJson.price)))
                fs.writeFileSync(supply, formatNumber(parseFloat(coinJson.circulating.toFixed(2))))

                //Market cap
                fs.writeFileSync(marketcap, formatNumber(parseFloat((coinJson.circulating * coinJson.price).toFixed(2))))
              }
              if(coinlistClone.length > 0){
                var element = coinlistClone[0]
                coinlistClone.splice(0,1)
                setTimeout(function(){
                  getData(element)
                }, 10000);
              }
              else
              {
                setTimeout(function(){
                  createData()
                  console.log("finished")
                }, 20000);
              }
            }
          }
          else {
            if(coinlistClone.length > 0){
              var element = coinlistClone[0]
              coinlistClone.splice(0,1)
              setTimeout(function(){
                getData(element)
              }, 10000);
            }
            else
            {
              setTimeout(function(){
                console.log("finished")
                createData()
              }, 20000);
            }
          }
        })
      }
      var element = coinlistClone[0]
      coinlistClone.splice(0,1)
      getData(element)
    }
    catch(ex){
      setTimeout(function() {
        createData()
      }, 20000);
    }

  })
}

createData()

function getWebsiteContent(coin, name, url){
  return new Promise(async function(resolve){
    var rtnData = {}
    getData()
    function getData(){
      request(url, function (error, response, body) {
        // console.error('error:', error); // Print the error if one occurred
        console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
        // console.log('body:', body); // Print the HTML for the Google homepage.
        if(response && response.statusCode == 200) {
          try {
            var pricechange = body.split("details-panel-item--price")[2].split("toolbar-buttons")[0]
            pricechange = pricechange.split("toolbar-buttons")[0]
            pricechange = pricechange.split("data-format-percentage")[1].split("</span>")[0].split(">")[1]
            var split = body.split("cmc-cc-summary-table")[1]
            split = split.split("/table")[0]
            split = split.split("<th scope=\"row\">\n")
            var temp = []
            split.forEach(e => {
              if(e.toLowerCase().includes('price') || e.toLowerCase().includes('market cap') || e.toLowerCase().includes('24 hour volume') ||
              e.toLowerCase().includes('circulating supply'))
              {
                temp.push(e)
              }
            });
            for(var i = 0; i < temp.length; i++) {
              var splt = temp[i].split("\n</th>")
              var data = splt[1].split("<td>")[1].split("</td>")[0].split("</span>")[0].split(">")
              temp[i] = splt[0] + "|" + data[data.length - 1].replace(/,|\n|/g, '')
            }
            temp.push("Coin change|" + pricechange)
            rtnData.coin = coin
            rtnData.data = parseData(temp)
            rtnData.name = name
            resolve(rtnData)
          }
          catch(ex){
            getData()
          }
        }
        else {
          getData()
        }
      })
    }
  })
}

setInterval(function() {
  currTime = Math.floor(Date.now() / 1000)
  if(currTime - lastTime > 5 * 60 * 1000)
  {
    createData()
  }
}, 1000);

// getWebsiteContent('https://coinmarketcap.com/currencies/snowgem/', undefined, 'cmc-cc-summary-table', function(data){
//   fs.writeFileSync("data.txt", data[0])
// })