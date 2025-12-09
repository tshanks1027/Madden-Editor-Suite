const TDBExtraDataField = require("./TDBExtraDataField");

class TDBUncompressedField extends TDBExtraDataField {
    constructor() {
        super();
    };

    get value() {
        if (this.extraDataBuffer) {
            return this.extraDataBuffer.toString('utf8', this.offsetLength).replace(/\0/g, '');
        }
        else {
            return '';
        }
    };

    set value(value) {
        // Handle null/undefined/empty values
        const safeValue = value || '';
        const offsetBuffer = Buffer.alloc(this.offsetLength);
        offsetBuffer.writeIntBE(safeValue.length, 0, this.offsetLength);

        let strHexArray = safeValue.split('').map((char) => {
            return char.charCodeAt(0);
        });

        this.extraDataBuffer = Buffer.concat([offsetBuffer, Buffer.from(strHexArray)]);
        this.extraDataOffset = value.length;
        this._isChanged = true;
    };
};

module.exports = TDBUncompressedField;