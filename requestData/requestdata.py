import os, sys
import time, datetime

import json, yaml
import webapp2
from subprocess import Popen, PIPE, STDOUT
import hashlib
import numpy as np

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


# Some Contants
URL_BASE = 'http://ltweb.ceoas.oregonstate.edu/mapping/'
REQUEST_PATH = '/mapping/requestData/';          # where this webapp is mounted / virtual hosted
FULL_APP_PATH = '/var/www/html/mapping/'

# WebApp2 servlet to handle requests for timeseries over the patch data
class DataHandler(webapp2.RequestHandler):
    def get(self, path=''):
        # params keep both GET and POST values
        GET = self.request.params
        message = parseRequest(GET)
        self.response.write(message)

    # Do same thing on GET and POST methods
    def post(self, path=''):
        self.get(path)

# Initialize the webapp handlers.
application = webapp2.WSGIApplication([
    (REQUEST_PATH, DataHandler),
], debug=True)


def parseRequest(data):

    data = {x:str(data[x]) for x in data}

    if data['req-op'] == 'clipregion':    
        return clipMap(data)

    elif data['req-op'] == 'queryregion':
        return queryRegion(data)

    else:
        return 'Operation {0} not supported'.format(data['req-op'])
    
    
def getDatasetPath(dataset):
    return FULL_APP_PATH + '/maps/'+dataset

    
def readMetadata(dataset):
    with open(getDatasetPath(dataset)+'/metadata.yaml', 'r') as m:
        metadata = yaml.safe_load(m)
    
    return metadata
    

def parseDate(date):
    return yaml.load(date)
    
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

    
def queryRegion(data):

    # Get data from web app
    d = {'property':'default', 'reducer':'default', 'format':'json'}
    d.update(data)

    dataset = d['dataset'].strip()
    property = d['property'].strip()
    reducer = d['reducer']
    region = d['region']
    format = d['format']
    dates = json.loads(d['date'])
    
    # Input normalization
    if isinstance(dates, basestring):
        dates = [dates]
    dates = [parseDate(x) for x in dates]
    
    if isinstance(reducer, basestring):
        reducer = [x.strip() for x in reducer.split(',')]
    
    # Read Metadata
    metadata = readMetadata(dataset)
    
    # Update defaults from metadata
    if d['property'] == 'default':
        d['property'] = metadata['default-property']
    if d['reducer'] == 'default':
        d['reducer'] == metadata['default-reducer']
    
    # Presume a geojson srs of EPSG:4326
    geom = ogr.CreateGeometryFromJson(region.encode('utf-8'))
    srs = osr.SpatialReference()
    srs.ImportFromEPSG(4326)
    geom.AssignSpatialReference(srs)
    
    # Get raster path
    rasterfn = getDatasetPath(dataset) + '/{property}.vrt'.format(property=property)
    
    # Determine required bands
    bandDates = metadata['band-dates']
    bands = selectBandsByDate(dates, bandDates)
    values = fetchRegion(geom, rasterfn, bands)
    
    response = {'dataset':dataset,
                'property':property,
                }
    out = {str(bandDates[x]):values[x] for x in values}
    
    for r in reducer:
        response[r] = reduce(out, r)
    
    if format == 'yaml':
        return yaml.dump(response)
    else:
        return json.dumps(response)
    

def clipRegion(data):

    # Some constants
    SUCCESS_MESSAGE = '<b>Request complete.</b><br>You can download your data here: <a href="{link}" target="_blank">clipped.tif</a>'
    TIMEOUT_MESSAGE = 'Your request is taking longer than expected. You can follow the status of your request here: <a href="{link}" target="_blank">Request Status</a>'
    COMMAND = 'timeout 30m /usr/lib/anaconda/bin/gdalwarp --config GDAL_DATA /usr/lib/anaconda/share/gdal -of GTiff -tap -tr {res} {res} -r near -crop_to_cutline -cutline {bounds_file} {in_map} {out_map}'

    # Mostly unused, but a reminder of what's being sent.
    name = data['req-name']
    email = data['req-email']
    resolution = int(data['req-resolution'])
    layer = data['dataset']

    map_fn = FULL_APP_PATH + '/maps/{0}/map.tif'.format(data['layer'])
    # Validate that Layer exists
    if not os.path.isfile(map_fn):
        return "Invalid Map Request"

    # Derive a unique-ish name to use a location to store the results
    p = data['geoJSON'] + data['layer'] + data['req-resolution'] + data['req-email']
    hash = hashlib.md5(p).hexdigest()
    request_name = data['layer']+'_'+hash[:8]

    outpath = FULL_APP_PATH + 'results/'+ request_name
    if not os.path.exists(outpath):
        os.makedirs(outpath)

    # write the geoJSON to a file so gdalwarp can read it in
    geo_fn = outpath+'/mask.json'
    with open(geo_fn, 'w+') as f:
        f.write(data['geoJSON'])

    # The replaces give some protection against maliciously formed input
    out_map = outpath+'/clipped.tif'
    map_link = URL_BASE + 'results/' + request_name + '/clipped.tif'

    # Build the gdalwarp command
    job = COMMAND.format(res=resolution, bounds_file=geo_fn, in_map=map_fn, out_map=out_map)
    job = job.replace(';', '').replace("\n", '')

    # Make a status report file and pipe gdalwarp output there
    out_file = open(outpath+'/status.txt', 'w+')
    out_file.write("{0}: {1}\n".format(name, email))
    out_file.flush()
    proc = Popen(job.split(), stdout=out_file, stderr=out_file)

    # Wait 30 seconds for the clipping to be complete. Most are done in under 5.
    for i in xrange(30):
        if proc.poll() == None:
            time.sleep(1)
        else:
            # It's complete! Send out a success message linking to the map
            if os.path.isfile(out_map):
                return SUCCESS_MESSAGE.format(link=map_link, status=proc.poll())
            else:
                return "An unknown error occurred while extracting data."

    # This is taking awhile. Send a message linking to the status report page
    request_link = URL_BASE + 'results.php?r='+request_name
    return TIMEOUT_MESSAGE.format(link=request_link)
    
    
    
def reduce(data, reducer):
    if reducer == 'mean':   return {x: float(np.mean(data[x])) for x in data}
    if reducer == 'median': return {x: float(np.median(data[x])) for x in data} 
    if reducer == 'std':    return {x: float(np.std(data[x])) for x in data}
    if reducer == 'var':    return {x: float(np.var(data[x])) for x in data}
    if reducer == 'max':    return {x: float(np.max(data[x])) for x in data}
    if reducer == 'min':    return {x: float(np.min(data[x])) for x in data}
    if reducer == 'identity': return {x: data[x].tolist() for x in data}
    
def reproject(source, target):

    # Source may be a geometry or a raster
    if hasattr(source, 'GetSpatialReference'):
        sourceSR = source.GetSpatialReference()
    else:
        sourceSR = osr.SpatialReference()
        sourceSR.ImportFromWkt(source.GetProjectionRef())
    
    # Target may be a spatial reference, a geometry, or a raster
    if isinstance(target, osr.SpatialReference):
        targetSR = target
    elif hasattr(target, 'GetSpatialReference'):
        targetSR = target.GetSpatialReference()
    else:
        targetSR = osr.SpatialReference()
        targetSR.ImportFromWkt(target.GetProjectionRef()) 

    coordTrans = osr.CoordinateTransformation(sourceSR, targetSR)
    source.Transform(coordTrans)
    
    return source
    
    
def getRasterOffset(point, raster_ds):
    # Get the raster pixel coordinate of a point (possibly in a different projection)
    point = reproject(point, raster_ds)
    x, y = point.GetPoints()[0]
    xOrigin, pixelWidth, xSkew, yOrigin, ySkew, pixelHeight = transform
    xoff = int((x - xOrigin)/pixelWidth)
    yoff = int((y - yOrigin)/pixelHeight)
    
    return xoff, yoff
    
    
def rasterizeGeometry(geom, raster_ds, burn_value=1):
    # Reproject vector geometry to same projection as raster
    rasterSR = osr.SpatialReference()
    rasterSR.ImportFromWkt(raster_ds.GetProjectionRef()) 
    geom = reproject(geom, rasterSR)
    
    # Get raster georeference info
    transform = raster_ds.GetGeoTransform()
    xOrigin, pixelWidth, xSkew, yOrigin, ySkew, pixelHeight = transform

    # Get region boundary in raster-space
    xmin, xmax, ymin, ymax = getBounds(geom)

    # Figure out where the Upper Left corner is
    ULx = xmin if pixelWidth>0 else xmax
    ULy = ymin if pixelHeight>0 else ymax
        
    xoff = int((ULx - xOrigin)/pixelWidth)
    yoff = int((ULy - yOrigin)/pixelHeight)
    xcount = int((xmax - xmin)/abs(pixelWidth))+1
    ycount = int((ymax - ymin)/abs(pixelHeight))+1

    # Build an in-memory vector layer in order to rasterize it
    region_ds = ogr.GetDriverByName('Memory').CreateDataSource('memdata')
    region_lyr = region_ds.CreateLayer('region', srs=rasterSR )
    feat = ogr.Feature( region_lyr.GetLayerDefn() )
    feat.SetGeometryDirectly(geom)
    region_lyr.CreateFeature(feat)
    
    # Create in-memory target raster to burn the layer into
    mask_ds = gdal.GetDriverByName('MEM').Create('', xcount, ycount, 1, gdal.GDT_Byte)
    mask_ds.SetGeoTransform( ( xmin, pixelWidth, 0, ymax, 0, pixelHeight) )
    mask_ds.SetProjection(rasterSR.ExportToWkt())
    
    # Rasterize zone polygon to raster
    gdal.RasterizeLayer(mask_ds, [1], region_lyr, burn_values=[burn_value])
    mask = mask_ds.ReadAsArray(0, 0, xcount, ycount).astype(np.bool)
    
    return mask, (xoff, yoff)
    
    
def fetchRegion(region, raster_fn, bands=None):
    # Open Raster
    raster_ds = gdal.Open(raster_fn)
    transform = raster_ds.GetGeoTransform()
    
    # Determine if need to grab just a single pixel or a region
    isPoint = (region.GetGeometryName() == 'POINT')
    
    if isPoint:
        # Grab just the single pixel covering the Point
        xoff, yoff = getRasterOffset(region, raster_ds)
        xcount, ycount = (1,1)
    else:
        # Get mask of region in raster-space
        mask, offsets = rasterizeGeometry(region, raster_ds, 1)
        xoff, yoff = offsets
        ycount, xcount = mask.shape


    # if bands isn't specified, read data in all of them
    if not bands:
        bands = range(1,raster_ds.RasterCount+1)
      
    # Read raster data
    data = {}
    for b in bands:
        band = raster_ds.GetRasterBand(b)
        data[b] = band.ReadAsArray(xoff, yoff, xcount, ycount).astype(np.float)
        if not isPoint:
            nd = band.GetNoDataValue()
            data[b] = data[b][mask]
            data[b][data[b]!=nd]
            
    return data


def getBounds(geom):

    # Collect vertices into a list
    points = []
    for g in geom:
        points += g.GetPoints()
    points = np.array(points)
    
    # Get min and max
    xmin, ymin = np.min(points, axis=0)
    xmax, ymax = np.max(points, axis=0)
       
    return ( xmin, xmax, ymin, ymax )