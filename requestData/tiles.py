import os, sys
import time, datetime
import logging
import json, yaml
import webapp2
import hashlib
import numpy as np


from PIL import Image

if 'GDAL_DATA' not in os.environ:
    os.environ['GDAL_DATA'] = r'/usr/lib/anaconda/share/gdal'
import gdal, ogr, osr

gdal.UseExceptions()
ogr.UseExceptions()
osr.UseExceptions()

def gdal_error_handler(err_class, err_num, err_msg):
    errtype = {
            gdal.CE_None:'None',
            gdal.CE_Debug:'Debug',
            gdal.CE_Warning:'Warning',
            gdal.CE_Failure:'Failure',
            gdal.CE_Fatal:'Fatal'
    }
    err_msg = err_msg.replace('\n',' ')
    err_class = errtype.get(err_class, 'None')
    print 'Error Number: %s' % (err_num)
    print 'Error Type: %s' % (err_class)
    print 'Error Message: %s' % (err_msg)

gdal.PushErrorHandler(gdal_error_handler)


# Some Constants
URL_BASE = 'http://ltweb.ceoas.oregonstate.edu/mapping/'
REQUEST_PATH = '/mapping/tiles/';          # where this webapp is mounted / virtual hosted
FULL_APP_PATH = '/var/www/html/mapping/'
CACHE_PATH = '/data/tilecache/'

# WebApp2 servlet to handle requests for timeseries over the patch data
class DataHandler(webapp2.RequestHandler):
    def get(self, *path):
        # params keep both GET and POST values
        query_data = self.request.params
        hash, image = parseRequest(*path)
        self.response.headers['Content-Type'] = "image/png"
        #self.response.headers['Cache-Control'] = "public, max-age=86400"
        self.response.write(image)
        
        addCache(hash, image)
        
    # Do same thing on GET and POST methods
    def post(self, path=''):
        self.get(path)
        
# Initialize the webapp handlers.
application = webapp2.WSGIApplication([
    (REQUEST_PATH+'(.+?)/(.+?)/(.+?)/(\d+)/(\d+)/(\d+).png', DataHandler),
], debug=True)


def readMetadata(dataset):
    with open(FULL_APP_PATH + '/maps/' + dataset + '/metadata.yaml', 'r') as m:
        return yaml.safe_load(m)


def parseRequest(dataset, property, date, zoom, y, x):
    # Parses a request for an image tile. Request paths are in the form:
    # http://ltweb.ceoas.oregonstate.edu/mapping/tiles/dataset/band_or_date/zoom/y/x.png

    #Get the band either from the request string or by choosing a nearest date
    if date[0] == 'b':
        band = int(date[1:])
    else:
        metadata = readMetadata(dataset)
        date = [yaml.load(date)]
        band = selectBandsByDate(date, metadata['band-dates'])[0]
    
    # implement some rudimentary cacheing
    hash = '{0}_{1}_{2}_{3}_{4}_{5}'.format(dataset, property, band, zoom, y, x)
    fn = CACHE_PATH + hash + '.png'
    if os.path.exists(fn):
        with open(fn, 'r') as f:
            image = f.read()
    else:
        
        # Don't read metadata twice if already have it
        try:
            metadata
        except NameError:
            metadata = readMetadata(dataset)
        
        if property == 'default':
            property = metadata['default-property']
        
        # Read raster data
        data, nd = readRaster(dataset, property, band, zoom, y, x)

        # Rescale or palette the data
        if 'palette' in metadata:
            image = toPaletted(data, nd, metadata['palette'])
        else:
            image = toGrayscale(data, nd, metadata['map-scaling'])
        
        # Build a byte string of the PNG data 
        image = buildPNG(image)
        
    return hash, image

    
def selectBandsByDate(dates, bandDates):
    bands = []
    
    if len(dates) == 1:
        distance = datetime.date.max - datetime.date.min
        for b in bandDates:
            if bandDates[b] - dates[0]  < distance:
                bands = [b]
    else:
        for b in bandDates:
            if bandDates[b] >= dates[0] and bandDates[b] <= dates[1]:
                bands.append(b)
    
    return bands
    
    
def addCache(hash, image):
    fn = CACHE_PATH + hash + '.png'
    with open(fn, 'w+') as f:
        f.write(image)
        
    
def toGrayscale(data, nd, scaling):
    low = scaling['min']
    high = scaling['max']

    out = np.ceil(255*(data-low)/(high-low))
    out[out<1] = 1
    out[out>255] = 255
    out[data==nd] = 0
    
    return out.astype(np.uint8)

    
def readRaster(dataset, property, b, zoom, x, y):
    
    #Open dataset and get transform
    rs = gdal.Open(FULL_APP_PATH + '/maps/'+dataset + '/tiled_' + property + '.vrt')
    xOrigin, pixelWidth, xSkew, yOrigin, ySkew, pixelHeight = rs.GetGeoTransform()
    
    # Get tile bounds
    xmin, xmax, ymin, ymax = tileBounds(x, y, zoom)

    # Figure out where the Upper Left corner is
    ULx = xmin if pixelWidth>0 else xmax
    ULy = ymin if pixelHeight>0 else ymax
    
    # Get the region to read
    xoff = int((ULx - xOrigin)/pixelWidth)
    yoff = int((ULy - yOrigin)/pixelHeight)
    xcount = int((xmax - xmin)/abs(pixelWidth))+1
    ycount = int((ymax - ymin)/abs(pixelHeight))+1
    
    # Read Data
    band = rs.GetRasterBand(b)
    A = band.ReadAsArray(xoff, yoff, xcount, ycount, 256, 256)
    nd = band.GetNoDataValue()
    
    return A, nd
    
    
def buildPNG(image_data, palette=''):
    import zlib, struct
    
    def png_pack(head, data):
        chunk = head + data
        return (struct.pack("!I", len(data)) +
                chunk +
                struct.pack("!I", 0xFFFFFFFF & zlib.crc32(chunk)))

    if palette:
        palette = palette.flatten().tolist()
        palette = png_pack(b'PLTE', b''.join([struct.pack('!B', 0xff * b) for b in palette]))
        color_type = 3
        transparent = b'\x00'
    else:
        color_type = 0
        transparent = b'\x00\x00'

    height, width = image_data.shape
    
    # Prepend each scan line with 0 for the filter type
    scan = np.zeros((height, width+1), np.uint8)
    scan[:,1:] = image_data;
    raw = scan.tobytes()

    return b''.join([
        b'\x89PNG\r\n\x1a\n',
        png_pack(b'IHDR', struct.pack("!2I5B", width, height, 8, color_type, 0, 0, 0)),
        png_pack(b'tRNS', transparent),
        #palette,
        png_pack(b'IDAT', zlib.compress(raw)),
        png_pack(b'IEND', b'')])

        
def tileBounds(tx, ty, zoom):
    '''Returns bounds of the given tile in EPSG:900913 coordinates'''
    
    tx= float(tx); ty = float(ty); zoom=float(zoom)
    
    #basis = 2 * math.pi * 6378137 
    basis = 40075016.68557849

    z = 2**zoom;
    ty = z-1-ty
    minx = basis * (tx/z - 0.5)
    miny = basis * (ty/z - 0.5)
    maxx = basis * ((tx+1)/z - 0.5)
    maxy = basis * ((ty+1)/z - 0.5)
    
    return (minx, maxx, miny, maxy)
    
    
def googleTile(tx, ty, zoom):
    '''Converts TMS tile coordinates to Google Tile coordinates'''
    return (tx, 2**zoom - 1 - ty)