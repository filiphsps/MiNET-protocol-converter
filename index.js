'use strict';
let fs = require('fs'),
    download = require('download-file-sync'),
    xml = require('xml2js').parseString;

let mappings = {};
let fields_switch = {};
let template = {
    "types": {
        //Types
        "string": [
            "pstring", {
                "countType":"i16"
            }],
        "lstring": [
            "pstring", {
                "countType":"li16"
            }],
        "vector3":[
            "container", [{
                    "name": "x",
                    "type": "f32"
                }, {
                    "name": "y",
                    "type": "f32"
                }, {
                    "name": "z",
                    "type": "f32"
                }]],
        "vector2":[
            "container", [{
                "name": "x",
                "type": "f32"
            }, {
                "name": "y",
                "type": "f32"
            }]],
        "playerlocation": [
            "array", {
                "countType":"i16",
                "type": [
                    "container", [{
                        "name": "x",
                        "type": "f32"
                    }, {
                        "name": "y",
                        "type": "f32"
                    }, {
                        "name": "z",
                        "type": "f32"
                    }, {
                        "name": "yaw",
                        "type": "f32"
                    }, {
                        "name": "pitch",
                        "type": "f32"
                    }, {
                        "name": "headYaw",
                        "type": "f32"
                    }]]}],

        //Packets
        "encapsulated_packet":[
            "container",
            [
                {
                    "name": "name",
                    "type": [
                        "mapper",
                        {
                            "type": "u8",
                            "mappings": {
                                "0xfe": "mcpe"
                            }
                        }
                    ]
                },
                {
                    "name": "params",
                    "type":[
                        "switch",
                        {
                            "compareTo": "name",
                            "fields":{
                                "mcpe": "mcpe_packet"
                            }
                        }
                    ]
                }
            ]
        ],
        "mcpe_packet": [
            "container",
            [
                {
                    "name": "name",
                    "type": [
                        "mapper",
                        {
                            "type": "u8",
                            "mappings": mappings
                        }
                    ]
                },
                {
                    "name": "params",
                    "type": [
                        "switch",
                        {
                            "compareTo": "name",
                            "fields": fields_switch
                        }
                    ]
                }
            ]
        ]
    }
}

module.exports = (callback) => {

    /* Download the protocol from the MiNET repo */
    xml(download('https://raw.githubusercontent.com/NiclasOlofsson/MiNET/master/src/MiNET/MiNET/Net/MCPE%20Protocol.xml'), (err, res) => {
        const Protocol = res.protocol.pdu;

        /* Parse and add every packet */
        Protocol.forEach((packet) => {
            let Packet = {
                name: convertName(packet.$.name.toLowerCase().split(' ').join('_').replace('mcpe_', '')),
                id: packet.$.id,
                type: 'packet_',
                online: packet.$.online,
                fields: []
            };
            Packet.type += Packet.name;

            if (!Packet.name)
                return;
            
            Packet.fields = customPacket(Packet.name);

            if (packet.field && Packet.fields.length <= 0)
                packet.field.forEach((field) => {
                    Packet.fields.push({
                        name: field.$.name.toLowerCase().split(' ').join('_'),
                        type: convertType(field.$.type.toLowerCase().split(' ').join('_'))
                    });
                });
            
            mappings[Packet.id] = Packet.name;
            fields_switch[Packet.name] = Packet.type;
            template.types[Packet.type] = ['container', Packet.fields];
        });

        fs.writeFileSync('output.json', JSON.stringify(template, null, 4));
        callback();
    });

    /* Handle edge-cases (thanks protodef :P) */
    function convertType (type) {
        switch (type) {
            case 'signedvarlong':
            case 'unsignedvarlong':
            case 'varlong':
            case 'signedvarint':
            case 'unsignedvarint':
                return 'varint';
            
            case 'byte':
                return 'u8';
            case 'short':
                return 'i16';
            case 'int':
                return 'i32';
            case 'uint':
                return 'u32';
            case 'float':
                return 'f32';
            case 'long':
                return 'i64';
            case 'ulong':
                return 'u64';

            case 'bytearray':
            case 'byte[]':
                return ["buffer", {
                            "countType": "varint",
                            "type": "i8"
                        }]; //FIXME: is this right?
            
            //FIXME: !!!
            case 'blockcoordinates':
            case 'mapinfo':
            case 'nbt':
            case 'item':
            case 'itemstacks':
            case 'recipes':
            case 'playerrecords':
            case 'playerattributes':
            case 'entityattributes':
            case 'records':
            case 'metadatadictionary':
            case 'metadataints':
            case 'rules':

            case 'resourcepackidversions':
            case 'resourcepackinfos':
                return 'varint';

            default:
                return type;
        }
    }

    function convertName (name) {
        if (name.substring(0, 3) == 'id_')
            return null;

        switch (name) {
            case 'login':
                return 'game_login';
            case 'server_exchange':
                return 'server_to_client_handshake';
            case 'client_magic':
                return 'client_to_server_handshake';
            case 'ftl_create_player':
                return 'game_login';

            case 'wrapper': //MCPE packet
                return null;

            default:
                return name;
        }
    }

    function customPacket (name) {
        switch (name) {
            case 'game_login':
                return [{
                        "name": "protocol",
                        "type": "i32"
                    }, {
                        "name": "edition",
                        "type": "i8"
                    }, {
                        "name": "body",
                        "type": [
                            "buffer", {
                                "countType": "varint"
                            }]}];
            
            case 'text':
                return [{
                            "name": "type",
                            "type": "i8"
                        }, {
                        "name": "source",
                        "type": [
                            "switch", {
                            "compareTo": "type",
                            "fields": {
                                "1": "string",
                                "3": "string"
                            },
                            "default": "void"
                            }
                        ]}, {
                        "name": "message",
                        "type": [
                            "switch", {
                            "compareTo": "type",
                            "fields": {
                                "0": "string",
                                "1": "string",
                                "2": "string",
                                "3": "string",
                                "4": "string",
                                "5": "string"
                            },
                            "default": "void"
                            }]}];

            default:
                return [];
        }
    }
};
