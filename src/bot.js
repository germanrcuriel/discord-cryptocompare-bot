const _ = require('lodash')
const Discord = require('discord.js')
const request = require('request')

const client = new Discord.Client()
const config = require('../config')

const PREFIX_REGEX = /\$(\w+)/gi
const COIN_REGEX = /^\/coin\s(.*)$/i

const MULTICOIN_PRICE = 'https://min-api.cryptocompare.com/data/pricemultifull'
const COIN_DATA = 'https://min-api.cryptocompare.com/data/all/coinlist'

class Bot {

  run () {
    client.on('ready', this.onReady.bind(this))
    client.on('message', this.onMessage.bind(this))
    client.login(config.bot.token)
  }

  onReady () {
    request(COIN_DATA, (err, response, body) => {
      if (err) {
        setTimeout(this.onReady, 10000)
        return
      }

      this.coinData = JSON.parse(body)
      setTimeout(this.onReady, 86400000)
    })
  }

  onMessage (message) {
    this.shouldReply(message, (type, msg) => {
      this.processReply(type, msg, message)
    })
  }

  shouldReply (message, callback) {
    if (message.author.bot) return false

    const isPrefix = message.content.match(PREFIX_REGEX)
    const isCoinCmd = message.content.match(COIN_REGEX)

    if (isPrefix) return callback('prefix', isPrefix, message)
    if (isCoinCmd) return callback('coin', isCoinCmd, message)
  }

  processReply (type, msg, originalMsg) {
    let coins

    switch (type) {
      case 'prefix':
        coins = msg.map(sym => sym.substr(1).toUpperCase())
        this.replyWithCoinValues(originalMsg, ...coins)
        break

      case 'coin':
        coins = msg[1].toUpperCase().split(' ')
        this.replyWithCoinConversions(originalMsg, ...coins)
        break
    }
  }

  replyWithCoinValues (message, ...coins) {
    const fsyms = coins.join(',')
    const tsyms = 'USD,EUR'
    this.fetchInfo(fsyms, tsyms, (embeds) => { this.sendMessage(message.channel, embeds) })
  }

  replyWithCoinConversions (message, coin, ...conversions) {
    const fsyms = coin
    const tsyms = conversions.join(',')
    this.fetchInfo(fsyms, tsyms, (embed) => { this.sendMessage(message.channel, embed) })
  }

  fetchInfo (fsyms, tsyms, embed) {
    request(`${MULTICOIN_PRICE}?fsyms=${fsyms}&tsyms=${tsyms}`, (err, response, body) => {
      if (err) return false
      return embed(this.parseResponse(JSON.parse(body)))
    })
  }

  parseResponse (body) {
    const res = body.DISPLAY
    let embeds = []

    Object.keys(res).map((coin) => {
      if (!this.coinData.Data[coin]) return

      let embed = new Discord.RichEmbed()
        //.setThumbnail(`${this.coinData.BaseImageUrl}${this.coinData.Data[coin].ImageUrl}`)
        .setAuthor(`1 ${this.coinData.Data[coin].FullName}`, `${this.coinData.BaseImageUrl}${this.coinData.Data[coin].ImageUrl}`)
        .setURL(`${this.coinData.BaseLinkUrl}${this.coinData.Data[coin].Url}`)

      let lines = []

      Object.keys(res[coin]).map((conversion) => {
        let currency = this.coinData.Data[conversion]
        currency = (currency) ? currency.FullName : conversion

        let { PRICE, CHANGEPCT24HOUR, CHANGE24HOUR } = res[coin][conversion]

        lines.push(`**${currency}**: ${PRICE} | **-24h**: ${CHANGEPCT24HOUR}% (${CHANGE24HOUR})`)
      })

      embed.setDescription(lines.join('\n'))
      embeds.push(embed)
    })

    return embeds
  }

  sendMessage (channel, embeds) {
    const defaultChannel = client.guilds.first().channels.find('name', config.discord.channel)
    channel = (channel) ? channel : defaultChannel

    if (embeds) {
      embeds.map(embed => {
        channel.send({embed})
      })
    }
  }

}

module.exports = Bot
