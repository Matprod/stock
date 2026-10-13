import { deflate, inflate } from 'pako'
import { DATA_TYPE, type DataType } from '#constants/serie.constants'
import { inv, multiply, transpose } from 'mathjs'

export const ewmaScalar = (data: number[], alpha: number): number => {
  if (data.length === 0) return 0

  return data.reduce((prev, current) => {
    return alpha * current + (1 - alpha) * prev
  })
}

export const standardDeviation = (data: number[], debug?: boolean): number | null => {
  if (data.length <= 1) return null

  const mean = data.reduce((sum, val) => sum + val, 0) / data.length
  const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (data.length - 1)

  if (debug) {
    console.log(`|standardDeviation| mean: ${mean}`)
    console.log(`|standardDeviation| variance: ${variance}`)
    console.log(`|standardDeviation| result: ${Math.sqrt(variance)}`)
  }
  return Math.sqrt(variance)
}

export const median = (data: number[]): number => {
  if (data.length === 0) return 0

  const sortedData = [...data].sort((a, b) => a - b)
  const middle = Math.floor(sortedData.length / 2)

  if (sortedData.length % 2 === 0) {
    return (sortedData[middle - 1] + sortedData[middle]) / 2
  } else {
    return sortedData[middle]
  }
}

/**
 * Decode Base64 encoded and zlib compressed time series data to numeric values.
 *
 * @param encodedData - Base64 encoded and zlib compressed data
 * @param dataType - Type of data ('float', 'unsigned', 'signed')
 * @param bits - Bit size (8, 16, 32, 64)
 * @returns Array of decoded numeric values
 * @throws Error if the data cannot be decoded or decompressed
 */
export const decodeTimeseries = (
  encodedData: string,
  dataType: DataType = DATA_TYPE.UNSIGNED,
  bits: 8 | 16 | 32 | 64 = 8,
  littleEndian = true
): number[] => {
  try {
    const decodedBytes = atob(encodedData)
    const binaryString = new Uint8Array(decodedBytes.length)

    for (let i = 0; i < decodedBytes.length; i++) {
      binaryString[i] = decodedBytes.charCodeAt(i)
    }

    const decompressedData = inflate(binaryString)
    const decodedBytesArray = new Uint8Array(decompressedData)

    const bytesPerValue = bits / 8
    const result: number[] = []

    if (decodedBytesArray.length % bytesPerValue !== 0) {
      console.warn(
        `Data length (${decodedBytesArray.length}) is not a multiple of ${bytesPerValue}`
      )
    }

    const dataView = new DataView(
      decodedBytesArray.buffer,
      decodedBytesArray.byteOffset,
      decodedBytesArray.byteLength
    )

    for (let i = 0; i < decodedBytesArray.length; i += bytesPerValue) {
      if (i + bytesPerValue <= decodedBytesArray.length) {
        try {
          let value: number

          switch (dataType) {
            case DATA_TYPE.FLOAT:
              if (bits === 32) {
                value = dataView.getFloat32(i, littleEndian)
              } else if (bits === 64) {
                value = dataView.getFloat64(i, littleEndian)
              } else {
                throw new Error(`Unsupported FLOAT bit size: ${bits}`)
              }
              break

            case DATA_TYPE.UNSIGNED:
              if (bits === 8) {
                value = dataView.getUint8(i)
              } else if (bits === 16) {
                value = dataView.getUint16(i, littleEndian)
              } else if (bits === 32) {
                value = dataView.getUint32(i, littleEndian)
              } else if (bits === 64) {
                const bigValue = dataView.getBigUint64(i, littleEndian)
                value = Number(bigValue)
              } else {
                throw new Error(`Unsupported UNSIGNED bit size: ${bits}`)
              }
              break

            case DATA_TYPE.SIGNED:
              if (bits === 8) {
                value = dataView.getInt8(i)
              } else if (bits === 16) {
                value = dataView.getInt16(i, littleEndian)
              } else if (bits === 32) {
                value = dataView.getInt32(i, littleEndian)
              } else if (bits === 64) {
                const bigValue = dataView.getBigInt64(i, littleEndian)
                value = Number(bigValue)
              } else {
                throw new Error(`Unsupported SIGNED bit size: ${bits}`)
              }
              break

            default:
              throw new Error(`Unsupported data type: ${dataType}`)
          }

          result.push(value)
        } catch (error) {
          console.error(`Error unpacking at position ${i}: ${error}`)
          break
        }
      }
    }

    return result
  } catch (error) {
    throw new Error(`Error decoding time series data: ${error}`)
  }
}

/**
 * Encode numeric values to Base64 encoded and zlib compressed time series data.
 * This is the inverse operation of decodeTimeseries.
 *
 * @param numericData - Array of numeric values to encode
 * @param dataType - Type of data ('float', 'unsigned', 'signed')
 * @param bits - Bit size (8, 16, 32, 64)
 * @returns Base64 encoded and zlib compressed data as string
 * @throws Error if the data cannot be encoded, compressed or encoded
 */
export const encodeTimeseries = (
  numericData: number[],
  dataType: DataType = DATA_TYPE.UNSIGNED,
  bits: 8 | 16 | 32 | 64 = 8
): string => {
  try {
    const bytesPerValue = bits / 8
    const buffer = new ArrayBuffer(numericData.length * bytesPerValue)
    const dataView = new DataView(buffer)

    for (let i = 0; i < numericData.length; i++) {
      const offset = i * bytesPerValue
      const value = numericData[i]

      switch (dataType) {
        case DATA_TYPE.FLOAT:
          if (bits === 32) {
            dataView.setFloat32(offset, value, true)
          } else if (bits === 64) {
            dataView.setFloat64(offset, value, true)
          } else {
            throw new Error(`Unsupported FLOAT bit size: ${bits}`)
          }
          break

        case DATA_TYPE.UNSIGNED:
          if (bits === 8) {
            if (value < 0 || value > 255) {
              throw new Error(`Value ${value} out of range for Uint8 (0-255)`)
            }
            dataView.setUint8(offset, value)
          } else if (bits === 16) {
            if (value < 0 || value > 65535) {
              throw new Error(`Value ${value} out of range for Uint16 (0-65535)`)
            }
            dataView.setUint16(offset, value, true)
          } else if (bits === 32) {
            if (value < 0 || value > 4294967295) {
              throw new Error(`Value ${value} out of range for Uint32 (0-4294967295)`)
            }
            dataView.setUint32(offset, value, true)
          } else if (bits === 64) {
            if (value < 0 || value > Number.MAX_SAFE_INTEGER) {
              throw new Error(`Value ${value} out of range for Uint64`)
            }
            dataView.setBigUint64(offset, BigInt(value), true)
          } else {
            throw new Error(`Unsupported UNSIGNED bit size: ${bits}`)
          }
          break

        case DATA_TYPE.SIGNED:
          if (bits === 8) {
            if (value < -128 || value > 127) {
              throw new Error(`Value ${value} out of range for Int8 (-128 to 127)`)
            }
            dataView.setInt8(offset, value)
          } else if (bits === 16) {
            if (value < -32768 || value > 32767) {
              throw new Error(`Value ${value} out of range for Int16 (-32768 to 32767)`)
            }
            dataView.setInt16(offset, value, true)
          } else if (bits === 32) {
            if (value < -2147483648 || value > 2147483647) {
              throw new Error(`Value ${value} out of range for Int32 (-2147483648 to 2147483647)`)
            }
            dataView.setInt32(offset, value, true)
          } else if (bits === 64) {
            if (value < Number.MIN_SAFE_INTEGER || value > Number.MAX_SAFE_INTEGER) {
              throw new Error(`Value ${value} out of range for Int64`)
            }
            dataView.setBigInt64(offset, BigInt(value), true)
          } else {
            throw new Error(`Unsupported SIGNED bit size: ${bits}`)
          }
          break

        default:
          throw new Error(`Unsupported data type: ${dataType}`)
      }
    }

    const uint8Array = new Uint8Array(buffer)

    const compressedData = deflate(uint8Array)

    let binaryString = ''
    for (let i = 0; i < compressedData.length; i++) {
      binaryString += String.fromCharCode(compressedData[i])
    }

    return btoa(binaryString)
  } catch (error) {
    throw new Error(`Error encoding time series data: ${error}`)
  }
}

export const savitzkyGolay = (data: number[], windowSize = 5, polyOrder = 2): number[] => {
  if (windowSize % 2 === 0) throw new Error('Window size must be odd')
  const n = Math.floor(windowSize / 2)

  const A = []
  for (let i = -n; i <= n; i++) {
    A.push(Array.from({ length: polyOrder + 1 }, (_, j) => Math.pow(i, j)))
  }

  const AT = transpose(A)
  const ATA = multiply(AT, A)
  const ATAinv = inv(ATA)
  const coeffs = multiply(ATAinv, AT)[0]

  const result = []
  for (let k = 0; k < data.length; k++) {
    let sum = 0
    for (let j = -n; j <= n; j++) {
      const idx = Math.min(data.length - 1, Math.max(0, k + j))
      sum += coeffs[j + n] * data[idx]
    }
    result.push(sum < 0.3 ? 0 : sum)
  }
  return result
}

export const encodeJsonPayload = <T>(payload: T): string => {
  try {
    const json = JSON.stringify(payload)
    const encoded = new TextEncoder().encode(json)
    const compressed = deflate(encoded)

    return Buffer.from(compressed).toString('base64')
  } catch (error) {
    throw new Error(`Error encoding JSON payload: ${error}`)
  }
}

export const decodeJsonPayload = <T>(encodedPayload: string): T => {
  try {
    const binaryArray = Buffer.from(encodedPayload, 'base64')

    const decompressed = inflate(binaryArray)
    const json = new TextDecoder().decode(decompressed)

    return JSON.parse(json) as T
  } catch (error) {
    throw new Error(`Error decoding JSON payload: ${error}`)
  }
}
