import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs/Rx';
import * as mqtt from 'mqtt';

import { environment } from '../../../environments/environment.prod';
import { JwtAuthHttp } from './../../services/http-auth.service';
import { consoleLog } from '../../app.helpers';
import { MQTTService } from './../../services/mqtt.service';

declare const AWS: any;
declare const JSONEditor: any;

@Component({
  selector: 'app-main',
  templateUrl: 'main-view.template.html'
})
export class MainViewComponent implements OnInit {
  urlAPIGetway = environment.API_URL + '/locations'

  ioT = {
    restFul: {
      url: 'a243uabiez3zv6.iot.us-east-1.amazonaws.com',
      thingName: 'HMLong-Thing1',
    },
    mqtt: {
      topic: '$aws/things/HMLong-Thing1/shadow',
    }
  }
  ioTRestF: any
  ioTMQTT: any

  // JsonEditor
  jeShadowRestF: any
  jeShadowMQTT: any
  jeShadowRestFData: any

  constructor(
    private _http: JwtAuthHttp,
    private _mqtt: MQTTService,
  ) {
  }

  ngOnInit() {
    this.getLocations();
    this.initIoTRestF();
    this.initIoTMQTT();
    this.initJsonE();
  }

  initJsonE() {
    const _defaultShadow = {
      state: {
        desired: {
          color: 'red'
        }
      }
    };
    const _options = {
      mode: 'code'
    };

    this.jeShadowMQTT = new JSONEditor(document.getElementById('jeShadow'), _options);
    this.jeShadowRestF = new JSONEditor(document.getElementById('jeShadowRestF'), _options);
    this.jeShadowMQTT.set(_defaultShadow);
    this.jeShadowRestF.set(_defaultShadow);
  }

  private getLocations() {
    const _eJson = new JSONEditor(document.getElementById('jeAPIG'));
    this._http
      .get(this.urlAPIGetway)
      .map(res => res.json())
      .subscribe(res => {
        _eJson.set(res)
      });
  }

  initIoTRestF() {
    this.jeShadowRestFData = new JSONEditor(document.getElementById('jeShadowRestFData'), { mode: 'view' });

    // Get Data Shadow
    this.ioTRestF = new AWS.IotData({
      endpoint: this.ioT.restFul.url
    });

    this.ioTRestF.getThingShadow({ thingName: this.ioT.restFul.thingName }, (err, res) => {
      this.jeShadowRestFData.set(JSON.parse(res.payload))
    })
  }

  initIoTMQTT() {
    let socketURL = null;
    const self = this;
    const jeShadowMQTTData = new JSONEditor(document.getElementById('jeShadowMQTTData'), { mode: 'view' });

    this._mqtt.generateURL().subscribe((_url) => {
      socketURL = _url;
      this.ioTMQTT = mqtt.connect(socketURL, {

        // Reconnect after disconnec from the network
        transformWsUrl: function (url, options, client) {
          self._mqtt.generateURL().subscribe((_res) => {
            consoleLog('Reconnect MQTT!')
            socketURL = _res;
          });
          return socketURL
        }
      });

      // Handle Received Messages
      this.ioTMQTT.on('message', (topic, message) => {
        jeShadowMQTTData.set(JSON.parse(message.toString()))
      })

      // Handle Conncted
      this.ioTMQTT.on('connect', () => {
        // Register topic
        this.ioTMQTT.subscribe(this.ioT.mqtt.topic + '/update' + '/accepted')
        this.ioTMQTT.subscribe(this.ioT.mqtt.topic + '/get' + '/accepted')

        // Get current shadow after x second
        setTimeout(() => {
          this.ioTMQTT.publish(this.ioT.mqtt.topic + '/get')
        }, 1000)
      })
    })
  }

  /**
   * Update State Shadow
   * Ref https://stackoverflow.com/questions/40104559/forbidden-exception-on-accessing-aws-iot-using-amazon-cognito
   * @param mqttPro
   */
  updateIoT(mqttPro: boolean = false) {
    if (mqttPro) {
      // MQTT Protocol
      this.ioTMQTT.publish(this.ioT.mqtt.topic + '/update', JSON.stringify(this.jeShadowMQTT.get()))
    } else {
      // RestFul Protocol
      const _pars = {
        thingName: this.ioT.restFul.thingName,
        payload: JSON.stringify(this.jeShadowRestF.get())
      };

      this.ioTRestF.updateThingShadow(_pars, (err, res) => {
        this.jeShadowRestFData.set(JSON.parse(res.payload))
      })
    }
  }
}
