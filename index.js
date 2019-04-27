const fs = require('fs')
var request = require('request')
const phantom = require('phantom');
var isRunning = false
// var mainfile = "/var/www/html/rates/index.html"
// var supply = "/var/www/html/rates/supply"
// var marketcap = "/var/www/html/rates/marketcap"
// var currPrice = "/var/www/html/rates/price"
// var currPriceNoRound = "/var/www/html/rates/pricenoround"
// var priceChangeLoc = "/var/www/html/rates/pricechange"


var mainfile = "index.html"
var supply = "supply"
var marketcap = "marketcap"
var currPrice = "price"
var currPriceNoRound = "pricenoround"
var priceChangeLoc = "pricechange"

var usdUrl = "http://www.floatrates.com/daily/usd.json"
var xsgUrl = "https://coinmarketcap.com/currencies/snowgem/"
var btcUrl = "https://coinmarketcap.com/currencies/bitcoin/"
var bchUrl = "https://coinmarketcap.com/currencies/bitcoin-cash/"
var zecUrl = "https://coinmarketcap.com/currencies/zcash/"

function curlData(urlRequest, params){
  return new Promise(function(resolve){
    request.post(urlRequest, {
      json: params
    }, (error, res, body) => {
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
  })
}

function formatNumber(num) {
  return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')
}

function getWebsiteContent(coin, name, url, id, classname){
  return new Promise(async function(resolve){
    var driver = await phantom.create();
    var rtnData = {}
    try
    {
      var page = await driver.createPage();
      page.on('onConsoleMessage', (msg) => {
        // console.log('phantomjs page console message', msg);
      });
      page.on('onError', (msg) => {
        // console.log('phantomjs page console message', msg);
      });

      page.property("viewportSize", {width: 1920, height: 1080}).then(_ => {

      })

      page.on('onResourceRequested', function(requestData) {
        // console.info('Requesting', requestData.url);
      })
      page.open(url).then(_ => {
        id ? 
        page.evaluate(function(s) {
          return document.getElementsById(s)[0].innerText
        }, id ? id : classname).then(async function(data){
          data = standardData(data)
          driver.exit();
          rtnData.coin = coin
          rtnData.data = parseData(data.split(/\n/))
          rtnData.name = name
          console.log(rtnData)
          resolve(rtnData)
        })
        :
        page.evaluate(function(s) {
          return document.getElementsByClassName(s)[0].innerText;
        }, id ? id : classname).then(async function(data){
          data = standardData(data)
          driver.exit();
          rtnData.coin = coin
          rtnData.data = parseData(data.split(/\n/))
          rtnData.name = name
          console.log(rtnData)
          resolve(rtnData)
        })
      })
      function standardData(data){
        data = data.replace(/ \t|\t |\t/g, '|')
        data = data.replace(/ \n/g, ' ')
        return data
      }
      
    }
    catch(ex)
    {
      fs.appendFileSync(ex.toString())
      driver.exit()
      resolve(rtnData)
    }
  })
}

function parseData(data){
  var rtn = {}
  try
  {
    var index = data.findIndex(function(e){return e.toLowerCase().includes('price')})
    rtn.price = parseFloat(data[index].split('|')[1].split(' ')[0].split('$')[1])
    index = data.findIndex(function(e){return e.toLowerCase().includes('market cap')})
    rtn.marketcap = parseFloat(data[index].split('|')[1].split(' ')[0].split('$')[1])
    index = data.findIndex(function(e){return e.toLowerCase().includes('24 hour volume')})
    rtn.volume24h = parseFloat(data[index].split('|')[1].split(' ')[0].split('$')[1])
    index = data.findIndex(function(e){return e.toLowerCase().includes('circulating supply')})
    rtn.circulating = parseFloat(data[index].split('|')[1].split(' ')[0])
    index = data.findIndex(function(e){return e.toLowerCase().includes("yesterday's change")})
    rtn.change = parseFloat(data[index].split('|')[1].split('(')[1].split(')')[0])
  }
  catch(ex){}
  return rtn
}


function createData(){
  console.log("getting data")
  try
  {
    var promisesToMake = [
      getWebsiteContent('xsg', 'SnowGem', xsgUrl, undefined, 'cmc-cc-summary-table'),
      getWebsiteContent('btc', 'Bitcoin', btcUrl, undefined, 'cmc-cc-summary-table'),
      getWebsiteContent('bch', 'Bitcoin Cash', bchUrl, undefined, 'cmc-cc-summary-table'),
      getWebsiteContent('zec', 'Zcash', zecUrl, undefined, 'cmc-cc-summary-table'),
    ]
    var result = Promise.all(promisesToMake);
    result
    .then(function(result){
      var index = result.findIndex(function(e){return e.coin == 'xsg'})
      if(index > -1)
      {
        fs.writeFileSync(supply, formatNumber(parseFloat(result[index].data.circulating.toFixed(2))))

        //Market cap
        fs.writeFileSync(marketcap, formatNumber(parseFloat((result[index].data.circulating * result[index].data.price).toFixed(2))))
      }


      getUSD(function cb(data){
        var finalResult = []
        var btcJson = {}

        var index = result.findIndex(function(e){return e.coin == 'btc'})
        if(index > -1)
        {
          btcJson.code = "BTC"
          btcJson.symbol = "฿"
          btcJson.name = "Bitcoin"
          btcJson.rate = 1
          btcJson.price = result[index].data.price
          btcJson.pricechange = result[index].data.change
          btcJson.marketcap = result[index].data.marketcap
          btcJson.volume24h = result[index].data.volume24h
          btcJson.circulating = result[index].data.circulating
          finalResult.push(btcJson)
        }

        result.forEach(element => {
          if(element.coin != 'btc') {
            var coinJson = {}
            coinJson.code = element.coin.toUpperCase()
            coinJson.name = element.name
            coinJson.rate = parseFloat((btcJson.price / element.data.price).toFixed(2))
            coinJson.price = parseFloat((element.data.price).toFixed(3))
            coinJson.pricechange = element.data.change
            coinJson.marketcap = element.data.marketcap
            coinJson.volume24h = element.data.volume24h
            coinJson.circulating = element.data.circulating
            finalResult.push(coinJson)
          }
        });

        data = JSON.parse(data.result)
        var usdeur = data.eur.rate
        var usdrub = data.rub.rate
        var usdgbp = data.gbp.rate

        var usdJson = {}
        usdJson.code = "USD"
        usdJson.symbol = "$"
        usdJson.name = "US Dollar"
        usdJson.rate = parseFloat(btcJson.price.toFixed(2))

        var eurJson = {}
        eurJson.code = "EUR"
        eurJson.symbol = "€"
        eurJson.name = "Euro"
        eurJson.rate = parseFloat((btcJson.price * usdeur).toFixed(3))

        var rubJson = {}
        rubJson.code = "RUB"
        rubJson.symbol = "₽"
        rubJson.name = "Russian Rouble"
        rubJson.rate = parseFloat((btcJson.price * usdrub).toFixed(3))

        var gbpJson = {}
        gbpJson.code = "GBP"
        gbpJson.symbol = "£"
        gbpJson.name = "U.K. Pound Sterling"
        gbpJson.rate = parseFloat((btcJson.price * usdgbp).toFixed(3))

        finalResult.push(usdJson)
        finalResult.push(eurJson)
        finalResult.push(rubJson)
        finalResult.push(gbpJson)

        fs.writeFileSync(mainfile, JSON.stringify(finalResult))
        console.log(finalResult)
        isRunning = false
      })
    }, (reason) => {
      console.log(reason)
      fs.appendFileSync('reject', reason)
      isRunning = false
    })

    // getWebsiteContent(xsgUrl, undefined, 'cmc-cc-summary-table', function(dataXSG){
    //   if(dataXSG)
    //   {
    //     dataXSG = parseData(dataXSG)
    //     console.log(dataXSG)
    //     getWebsiteContent(btcUrl, undefined, 'cmc-cc-summary-table', function(dataBTC){
    //       if(dataBTC)
    //       {
    //         dataBTC = parseData(dataBTC)
    //         console.log(dataBTC)
    //         getWebsiteContent(bchUrl, undefined, 'cmc-cc-summary-table', async function(dataBCH){
    //           if(dataBCH){
    //             dataBCH = parseData(dataBCH)
    //             console.log(dataBCH)
    //             //Circulating supply
    //             fs.writeFileSync(supply, formatNumber(parseFloat(dataXSG.circulating.toFixed(2))))

    //             //Market cap
    //             fs.writeFileSync(marketcap, formatNumber(parseFloat((dataXSG.circulating * dataXSG.price).toFixed(2))))

    //             getUSD(function cb(data){
    //               // data = JSON.parse(JSON.stringify(data).replace('\"', '"'))
    //               // fs.writeFileSync("data.txt", JSON.stringify(data, null, 2))
    //               // var usdeur = data.result.eur.rate
    //               // var usdrub = data.result.rub.rate
    //               // var usdgbp = data.result.gbp.rate
    //               data = JSON.parse(data.result)
    //               var usdeur = data.eur.rate
    //               var usdrub = data.rub.rate
    //               var usdgbp = data.gbp.rate
                  
    //               var result = []

    //               var btcJson = {}
    //               btcJson.code = "BTC"
    //               btcJson.symbol = "฿"
    //               btcJson.name = "Bitcoin"
    //               btcJson.rate = 1
    //               btcJson.pricechange = dataBTC.change
    //               btcJson.marketcap = dataBTC.marketcap
    //               btcJson.volume24h = dataBTC.volume24h
    //               btcJson.circulating = dataBTC.circulating

    //               var xsgJson = {}
    //               xsgJson.code = "XSG"
    //               xsgJson.name = "SnowGem"
    //               xsgJson.rate = parseFloat((dataBTC.price / dataXSG.price).toFixed(2))
    //               xsgJson.price = parseFloat((dataXSG.price).toFixed(3))
    //               xsgJson.pricechange = dataXSG.change
    //               xsgJson.marketcap = dataXSG.marketcap
    //               xsgJson.volume24h = dataXSG.volume24h
    //               xsgJson.circulating = dataXSG.circulating

    //               var bchJson = {}
    //               bchJson.code = "BCH"
    //               bchJson.name = "Bitcoin Cash"
    //               bchJson.rate = parseFloat((dataBTC.price / dataBCH.price).toFixed(2))
    //               bchJson.pricechange = dataBCH.change
    //               bchJson.marketcap = dataBCH.marketcap
    //               bchJson.volume24h = dataBCH.volume24h
    //               bchJson.circulating = dataBCH.circulating
                  
    //               var usdJson = {}
    //               usdJson.code = "USD"
    //               usdJson.symbol = "$"
    //               usdJson.name = "US Dollar"
    //               usdJson.rate = parseFloat(dataBTC.price.toFixed(2))

    //               var eurJson = {}
    //               eurJson.code = "EUR"
    //               eurJson.symbol = "€"
    //               eurJson.name = "Euro"
    //               eurJson.rate = parseFloat((dataBTC.price * usdeur).toFixed(3))

    //               var rubJson = {}
    //               rubJson.code = "RUB"
    //               rubJson.symbol = "₽"
    //               rubJson.name = "Russian Rouble"
    //               rubJson.rate = parseFloat((dataBTC.price * usdrub).toFixed(3))

    //               var gbpJson = {}
    //               gbpJson.code = "GBP"
    //               gbpJson.symbol = "£"
    //               gbpJson.name = "U.K. Pound Sterling"
    //               gbpJson.rate = parseFloat((dataBTC.price * usdgbp).toFixed(3))

    //               result.push(btcJson)
    //               result.push(xsgJson)
    //               result.push(bchJson)
    //               result.push(usdJson)
    //               result.push(eurJson)
    //               result.push(rubJson)
    //               result.push(gbpJson)

    //               fs.writeFileSync(mainfile, JSON.stringify(result))
    //               isRunning = false
    //             })
    //           }
    //           else
    //           {
    //             isRunning = false
    //           }
    //         }).catch(() => {
    //           isRunning = false
    //         })
    //       }
    //       else
    //       {
    //         isRunning = false
    //       }
    //     }).catch(() => {
    //       isRunning = false
    //     })
    //   }
    //   else
    //   {
    //     isRunning = false
    //   }
    // }).catch(() => {
    //   isRunning = false
    // })
  }
  catch(ex){
    isRunning = false
  }
}

setInterval(() => {
  if(!isRunning)
  {
    isRunning = true
    createData()
  }
  else
  {
    console.log("is running")
  }
  console.log("sleep 20s")
}, 20000);


// getWebsiteContent('https://coinmarketcap.com/currencies/snowgem/', undefined, 'cmc-cc-summary-table', function(data){
//   fs.writeFileSync("data.txt", data[0])
// })